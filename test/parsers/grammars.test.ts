import { describe, it, expect } from 'vitest';
import {
  getParser,
  getLanguage,
  GRAMMAR_NAMES,
  grammarForExtension,
} from '../../src/parsers/index.js';

/**
 * The M0 gate. Everything downstream assumes these five grammars load under the pinned
 * web-tree-sitter. If this file goes red after a dependency bump, the ABI drifted --
 * see DECISIONS.md #2 before changing anything else.
 */
describe('grammar loading', () => {
  const samples: Record<string, { src: string; root: string }> = {
    typescript: {
      src: 'describe("x", () => { it("y", () => { expect(a).toBe(1); }); });',
      root: 'program',
    },
    tsx: { src: 'const A = () => <div>{x}</div>;', root: 'program' },
    javascript: { src: 'test("y", () => { expect(a).toEqual(1); });', root: 'program' },
    python: { src: 'def test_x():\n    assert a == 1\n', root: 'module' },
    ruby: {
      src: 'describe "x" do\n  it "y" do\n    expect(a).to eq(1)\n  end\nend\n',
      root: 'program',
    },
  };

  it.each(GRAMMAR_NAMES)('loads and parses %s without error nodes', async (name) => {
    const sample = samples[name];
    expect(sample, `no sample source for grammar ${name}`).toBeDefined();
    const parser = await getParser(name);
    const tree = parser.parse(sample!.src);
    expect(tree).not.toBeNull();
    expect(tree!.rootNode.type).toBe(sample!.root);
    expect(tree!.rootNode.hasError).toBe(false);
  });

  it('reports an ABI version tree-sitter accepts', async () => {
    for (const name of GRAMMAR_NAMES) {
      const lang = await getLanguage(name);
      expect(lang.abiVersion).toBeGreaterThanOrEqual(13);
    }
  });

  it('maps file extensions to grammars', () => {
    expect(grammarForExtension('.ts')).toBe('typescript');
    expect(grammarForExtension('.TSX')).toBe('tsx');
    expect(grammarForExtension('.rb')).toBe('ruby');
    expect(grammarForExtension('.py')).toBe('python');
    expect(grammarForExtension('.go')).toBeUndefined();
  });
});
