import { Parser, Language } from 'web-tree-sitter';
import { readGrammar, runtimeWasmPath, GRAMMAR_NAMES, type GrammarName } from './wasm.js';
import type { LanguageAdapter } from './types.js';

/**
 * Language registry. Adding a language means writing one adapter file and adding it here.
 * Nothing else in the codebase should need to change.
 */

let initialized = false;
const languages = new Map<GrammarName, Language>();
const parsers = new Map<GrammarName, Parser>();

/** Idempotent. Safe to call from every entry point. */
export async function initParsers(): Promise<void> {
  if (initialized) return;
  const runtime = runtimeWasmPath();
  await Parser.init(runtime ? { locateFile: () => runtime } : undefined);
  initialized = true;
}

/** Grammars are loaded lazily -- a diff with no Ruby in it never pays for the Ruby grammar. */
export async function getLanguage(name: GrammarName): Promise<Language> {
  await initParsers();
  const cached = languages.get(name);
  if (cached) return cached;
  const lang = await Language.load(readGrammar(name));
  languages.set(name, lang);
  return lang;
}

/** One Parser per language, reused across every file. Matters for the 5s budget. */
export async function getParser(name: GrammarName): Promise<Parser> {
  const cached = parsers.get(name);
  if (cached) return cached;
  // getLanguage() runs initParsers() for us; Parser cannot be constructed before that.
  const lang = await getLanguage(name);
  const parser = new Parser();
  parser.setLanguage(lang);
  parsers.set(name, parser);
  return parser;
}

const EXT_TO_GRAMMAR: Record<string, GrammarName> = {
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'tsx',
  '.py': 'python',
  '.rb': 'ruby',
};

export function grammarForExtension(ext: string): GrammarName | undefined {
  return EXT_TO_GRAMMAR[ext.toLowerCase()];
}

const adapters = new Map<string, LanguageAdapter>();

/**
 * Builds and registers every adapter. Must be awaited before any AST rule runs; the engine
 * does this once per run when at least one AST rule is enabled.
 */
export async function initAdapters(): Promise<void> {
  if (adapters.size > 0) return;
  const [{ createTypeScriptAdapter }, { createRubyAdapter }, { createPythonAdapter }] =
    await Promise.all([import('./typescript.js'), import('./ruby.js'), import('./python.js')]);

  /** Binds a grammar's parser into the `parse(source) => Tree` an adapter expects. */
  const parseWith = async (grammar: GrammarName) => {
    const parser = await getParser(grammar);
    return (source: string) => {
      const tree = parser.parse(source);
      if (!tree) throw new Error(`failed to parse ${grammar} source`);
      return tree;
    };
  };

  registerAdapter(
    createTypeScriptAdapter('typescript', ['.ts', '.mts', '.cts'], await parseWith('typescript')),
  );
  // TSX and JSX share a grammar; plain JS parses correctly under it too, and using one
  // grammar for all three avoids a JSX file failing because it was sent to the TS parser.
  registerAdapter(createTypeScriptAdapter('tsx', ['.tsx', '.jsx'], await parseWith('tsx')));
  registerAdapter(
    createTypeScriptAdapter('javascript', ['.js', '.mjs', '.cjs'], await parseWith('javascript')),
  );
  registerAdapter(createRubyAdapter(await parseWith('ruby')));
  registerAdapter(createPythonAdapter(await parseWith('python')));
}

export function registerAdapter(adapter: LanguageAdapter): void {
  for (const ext of adapter.extensions) adapters.set(ext.toLowerCase(), adapter);
}

export function adapterForPath(filePath: string): LanguageAdapter | undefined {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return undefined;
  return adapters.get(filePath.slice(dot).toLowerCase());
}

export { GRAMMAR_NAMES };
export type { GrammarName };
export type { LanguageAdapter };
