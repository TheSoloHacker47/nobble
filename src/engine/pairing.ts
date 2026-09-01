import path from 'node:path';

/**
 * Source-to-test pairing, used by NOB-101 and NOB-202. Spec §5: try the heuristics in
 * order, stop at the first hit, and if nothing matches, skip the paired rules.
 *
 * "Never guess" is load-bearing. A wrong pairing makes NOB-202 accuse a developer of
 * changing security code without touching its tests when they did touch the real test
 * file, which is exactly the kind of false positive that gets a tool uninstalled.
 */

export interface PairingInput {
  /** Every tracked path in the repo, from `git ls-files`. */
  trackedFiles: string[];
}

const STRIP_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|rb|go)$/;

function withoutExt(p: string): string {
  return p.replace(STRIP_EXT, '');
}

function basenameNoExt(p: string): string {
  return withoutExt(path.posix.basename(p));
}

/** Candidate test paths for a JS/TS source file. */
function jsCandidates(file: string): string[] {
  const dir = path.posix.dirname(file);
  const base = basenameNoExt(file);
  const ext = path.posix.extname(file);
  const exts = ext === '.tsx' || ext === '.jsx' ? [ext, '.ts', '.js'] : [ext, '.ts', '.js'];
  const out: string[] = [];
  for (const e of new Set(exts)) {
    for (const kind of ['test', 'spec']) {
      out.push(path.posix.join(dir, `${base}.${kind}${e}`));
      out.push(path.posix.join(dir, '__tests__', `${base}.${kind}${e}`));
      // src/foo/bar.ts -> test/foo/bar.test.ts, __tests__/foo/bar.test.ts
      const stripped = dir.replace(/^(src|lib|app)\//, '').replace(/^(src|lib|app)$/, '');
      for (const root of ['test', 'tests', '__tests__', 'spec']) {
        out.push(path.posix.join(root, stripped, `${base}.${kind}${e}`));
      }
    }
  }
  return out;
}

/** Candidate test paths for a Ruby source file. */
function rubyCandidates(file: string): string[] {
  const base = basenameNoExt(file);
  // app/models/user.rb -> spec/models/user_spec.rb, test/models/user_test.rb
  const stripped = path.posix
    .dirname(file)
    .replace(/^(app|lib)\//, '')
    .replace(/^(app|lib)$/, '');
  return [
    path.posix.join('spec', stripped, `${base}_spec.rb`),
    path.posix.join('test', stripped, `${base}_test.rb`),
    path.posix.join(path.posix.dirname(file), `${base}_spec.rb`),
    path.posix.join(path.posix.dirname(file), `${base}_test.rb`),
  ];
}

/** Candidate test paths for a Python source file. */
function pythonCandidates(file: string): string[] {
  const dir = path.posix.dirname(file);
  const base = basenameNoExt(file);
  const stripped = dir.replace(/^(src|lib)\//, '').replace(/^(src|lib)$/, '');
  return [
    path.posix.join('tests', stripped, `test_${base}.py`),
    path.posix.join('test', stripped, `test_${base}.py`),
    path.posix.join(dir, `test_${base}.py`),
    path.posix.join('tests', `test_${base}.py`),
    path.posix.join(dir, `${base}_test.py`),
  ];
}

function candidatesFor(file: string): string[] {
  const ext = path.posix.extname(file).toLowerCase();
  if (ext === '.rb') return rubyCandidates(file);
  if (ext === '.py') return pythonCandidates(file);
  return jsCandidates(file);
}

/**
 * Returns the paired test path, or undefined when no pairing is certain.
 *
 * Heuristic 4 (basename match anywhere) fires *only* when exactly one candidate exists,
 * per the spec. Two candidates means ambiguity, and ambiguity means no pairing.
 */
export function findPairedTest(
  sourceFile: string,
  isTest: (p: string) => boolean,
  input: PairingInput,
): string | undefined {
  const tracked = new Set(input.trackedFiles);

  for (const candidate of candidatesFor(sourceFile)) {
    if (tracked.has(candidate)) return candidate;
  }

  // Heuristic 4: basename match anywhere in the repo, only if unambiguous.
  const base = basenameNoExt(sourceFile).toLowerCase();
  if (base.length < 3) return undefined; // too generic to match on safely
  const matches: string[] = [];
  for (const p of input.trackedFiles) {
    if (!isTest(p)) continue;
    const tb = basenameNoExt(p).toLowerCase();
    const normalized = tb.replace(/^test_/, '').replace(/[_.](test|spec)$/, '');
    if (normalized === base) {
      matches.push(p);
      if (matches.length > 1) return undefined; // ambiguous, so no pairing
    }
  }
  return matches[0];
}
