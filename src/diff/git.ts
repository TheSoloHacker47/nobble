import { execFileSync, spawnSync } from 'node:child_process';

export interface GitOptions {
  cwd?: string;
  /** Files larger than this are not read; no rule benefits enough to pay for them. */
  maxBlobBytes?: number;
}

const DEFAULT_MAX_BLOB = 1024 * 1024; // 1 MB

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

function git(args: string[], cwd: string, maxBuffer = 64 * 1024 * 1024): string {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer });
  if (res.error) throw new GitError(`git ${args[0]} failed: ${res.error.message}`);
  if (res.status !== 0) {
    throw new GitError(`git ${args.join(' ')} exited ${res.status}: ${(res.stderr || '').trim()}`);
  }
  return res.stdout;
}

export function isGitRepo(cwd = process.cwd()): boolean {
  const res = spawnSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8' });
  return res.status === 0;
}

export function revParse(ref: string, cwd = process.cwd()): string | undefined {
  const res = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd,
    encoding: 'utf8',
  });
  return res.status === 0 ? res.stdout.trim() : undefined;
}

/**
 * Resolves the default base. `origin/HEAD` is the spec's default but is frequently absent
 * on CI checkouts, so fall back through the usual suspects rather than failing.
 */
export function resolveBase(requested: string | undefined, cwd = process.cwd()): string {
  if (requested) {
    const sha = revParse(requested, cwd);
    if (!sha) throw new GitError(`base ref "${requested}" could not be resolved.`);
    return requested;
  }
  for (const candidate of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    if (revParse(candidate, cwd)) return candidate;
  }
  throw new GitError(
    'could not determine a base ref. Pass --base explicitly, e.g. "nobble --base main".',
  );
}

export function diffText(base: string, head: string | undefined, cwd = process.cwd()): string {
  const args = ['diff', '--no-color', '--no-ext-diff', '-M', '--find-renames'];
  // No head means "compare against the working tree", which is the CLI default.
  if (head) args.push(`${base}...${head}`);
  else args.push(base);
  return git(args, cwd);
}

/**
 * Batched blob reader.
 *
 * Several rules need the *before* content of a file, not just the diff hunks. Doing that
 * with one `git show <ref>:<path>` per file means one process spawn per file, which does
 * not fit the 5-second budget on a 500-file diff. `git cat-file --batch` reads them all
 * over a single pipe instead.
 *
 * Missing paths are reported by git as "<spec> missing" and come back as `undefined`
 * rather than throwing -- a file that did not exist in the base is a normal case (an
 * addition), not an error.
 */
export function readBlobs(
  ref: string,
  paths: string[],
  opts: GitOptions = {},
): Map<string, string | undefined> {
  const cwd = opts.cwd ?? process.cwd();
  const maxBlob = opts.maxBlobBytes ?? DEFAULT_MAX_BLOB;
  const out = new Map<string, string | undefined>();
  if (paths.length === 0) return out;

  const unique = [...new Set(paths)];
  const input = unique.map((p) => `${ref}:${p}`).join('\n') + '\n';

  // No `encoding` option: spawnSync then returns stdout as a Buffer, which is what the
  // length-prefixed batch format needs. Passing encoding:'buffer' instead would also try
  // to encode `input` with it and throw ERR_UNKNOWN_ENCODING.
  const res = spawnSync('git', ['cat-file', '--batch'], {
    cwd,
    input: Buffer.from(input, 'utf8'),
    maxBuffer: 512 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) {
    // Caller degrades to diff-only rules.
    for (const p of unique) out.set(p, undefined);
    return out;
  }

  const buf = res.stdout;
  let offset = 0;
  for (const p of unique) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl < 0) {
      out.set(p, undefined);
      continue;
    }
    const header = buf.toString('utf8', offset, nl);
    offset = nl + 1;

    // "<sha> <type> <size>" on success, "<spec> missing" otherwise.
    const parts = header.split(' ');
    if (parts.length < 3 || parts[parts.length - 1] === 'missing') {
      out.set(p, undefined);
      continue;
    }
    const size = Number(parts[2]);
    if (!Number.isFinite(size)) {
      out.set(p, undefined);
      continue;
    }
    const body = buf.subarray(offset, offset + size);
    offset += size + 1; // git writes a trailing newline after each object
    out.set(p, size > maxBlob ? undefined : body.toString('utf8'));
  }
  return out;
}

/** Every tracked path, used by the last-resort basename pairing heuristic. */
export function listTrackedFiles(cwd = process.cwd()): string[] {
  try {
    return git(['ls-files'], cwd).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function fetchBaseRef(baseRef: string, cwd = process.cwd()): boolean {
  const res = spawnSync('git', ['fetch', 'origin', baseRef, '--depth=1'], {
    cwd,
    encoding: 'utf8',
  });
  return res.status === 0;
}

export { execFileSync };
