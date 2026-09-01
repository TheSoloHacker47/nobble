#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { loadConfig, ConfigError } from './config/load.js';
import { run } from './engine/run.js';
import { exitCode } from './engine/score.js';
import { renderTerminal } from './report/terminal.js';
import { renderJson } from './report/json.js';
import { renderMarkdown } from './report/markdown.js';
import { renderSarif } from './report/sarif.js';
import { registerAllRules } from './rules/register.js';
import { isGitRepo, resolveBase, diffText, GitError } from './diff/git.js';
import type { FailOn } from './config/schema.js';

const VERSION = '0.1.0';

const HELP = `
nobble - catches nobbled tests

Usage: npx nobble [options]

Options:
  --base <ref>          Base git ref to diff against       [default: origin/HEAD]
  --head <ref>          Head ref                           [default: working tree]
  --diff <file>         Read a unified diff from a file or "-" for stdin
  --config <path>       Config file path                   [default: .nobble.yml]
  --format <fmt>        terminal | markdown | json | sarif [default: terminal]
  --fail-on <level>     none | warn | block                [default: none]
  --rules <ids>         Comma separated allowlist of rule IDs to run
  --quiet               Only print findings, no summary
  --version, --help
`.trimStart();

function readStdin(): string {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

async function main(argv: string[]): Promise<number> {
  registerAllRules();
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        base: { type: 'string' },
        head: { type: 'string' },
        diff: { type: 'string' },
        config: { type: 'string' },
        format: { type: 'string', default: 'terminal' },
        'fail-on': { type: 'string' },
        rules: { type: 'string' },
        quiet: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (err) {
    process.stderr.write(`nobble: ${err instanceof Error ? err.message : String(err)}\n\n${HELP}`);
    return 2;
  }

  const { values } = parsed;
  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const format = String(values.format);
  if (!['terminal', 'markdown', 'json', 'sarif'].includes(format)) {
    process.stderr.write(`nobble: --format must be terminal | markdown | json | sarif\n`);
    return 2;
  }

  const cwd = process.cwd();

  // --- config ---------------------------------------------------------------
  let config;
  try {
    config = loadConfig(values.config, cwd).config;
  } catch (err) {
    if (err instanceof ConfigError) {
      // err.message already embeds the problem list.
      process.stderr.write(`nobble: ${err.message}\n`);
      return 2;
    }
    throw err;
  }
  if (values['fail-on']) {
    const level = String(values['fail-on']);
    if (!['none', 'warn', 'block'].includes(level)) {
      process.stderr.write(`nobble: --fail-on must be none | warn | block\n`);
      return 2;
    }
    config.failOn = level as FailOn;
  }

  // --- diff -----------------------------------------------------------------
  let diff: string;
  let base: string | undefined;
  try {
    if (values.diff) {
      diff = values.diff === '-' ? readStdin() : fs.readFileSync(values.diff, 'utf8');
      // A supplied diff carries no base ref, so before-image rules degrade.
      base = values.base;
    } else {
      if (!isGitRepo(cwd)) {
        process.stderr.write(
          'nobble: not a git repository. Run inside a repo, or pass --diff <file>.\n',
        );
        return 2;
      }
      base = resolveBase(values.base, cwd);
      diff = diffText(base, values.head, cwd);
    }
  } catch (err) {
    if (err instanceof GitError) {
      process.stderr.write(`nobble: ${err.message}\n`);
      return 2;
    }
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      process.stderr.write(`nobble: diff file not found: ${values.diff}\n`);
      return 2;
    }
    throw err;
  }

  const result = await run({
    diffText: diff,
    config,
    cwd,
    base,
    ruleAllowlist: values.rules
      ? String(values.rules)
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : undefined,
  });

  switch (format) {
    case 'json':
      process.stdout.write(renderJson(result));
      break;
    case 'markdown':
      process.stdout.write(renderMarkdown(result));
      break;
    case 'sarif':
      process.stdout.write(renderSarif(result, VERSION));
      break;
    default:
      process.stdout.write(renderTerminal(result, { quiet: values.quiet }));
  }
  return exitCode(result.verdict, config.failOn);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(
      `nobble: ${err instanceof Error ? err.stack || err.message : String(err)}\n`,
    );
    process.exit(2);
  },
);
