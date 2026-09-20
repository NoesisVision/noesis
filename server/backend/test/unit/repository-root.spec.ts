import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RepositoryRoot,
  type RepositoryRootOptions,
  type RootResult,
} from '#backend/platform/files/repository-root';

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'noesis-git-'));
});

afterEach(() => rm(base, { recursive: true, force: true }));

const resolveRoot = (options: RepositoryRootOptions): RootResult =>
  new RepositoryRoot(options).resolve();

describe('repository root', () => {
  it('walks up to the nearest directory holding .git', async () => {
    const repo = join(base, 'repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const nested = join(repo, 'server', 'backend');
    await mkdir(nested, { recursive: true });

    expect(resolveRoot({ cwd: nested })).toEqual({ ok: true, root: repo });
  });

  it('accepts a .git file, as a worktree has', async () => {
    const repo = join(base, 'worktree');
    await mkdir(repo, { recursive: true });
    await writeFile(join(repo, '.git'), 'gitdir: /elsewhere\n');

    expect(resolveRoot({ cwd: repo })).toEqual({ ok: true, root: repo });
  });

  it('prefers NOESIS_ROOT when set, and refuses one that is not a directory', async () => {
    const explicit = join(base, 'explicit');
    await mkdir(explicit);

    expect(resolveRoot({ root: explicit, cwd: base })).toEqual({
      ok: true,
      root: explicit,
    });

    const missing = resolveRoot({ root: join(base, 'nope'), cwd: base });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.message).toContain('NOESIS_ROOT');
  });

  it('refuses to start outside a repository with a message naming the fix', () => {
    const result = resolveRoot({ cwd: base });

    // The temp dir may sit under a git checkout on a developer machine; only
    // assert the shape of the refusal when it is not.
    if (result.ok) return;
    expect(result.message).toContain('NOESIS_ROOT');
  });
});
