import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findRepositoryRoot,
  resolveRepositoryRoot,
} from '../../src/infra/files/repository-root.js';

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'noesis-git-'));
});

afterEach(() => rm(base, { recursive: true, force: true }));

describe('repository root', () => {
  it('walks up to the nearest directory holding .git', async () => {
    const repo = join(base, 'repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const nested = join(repo, 'server', 'backend');
    await mkdir(nested, { recursive: true });

    expect(findRepositoryRoot(nested)).toBe(repo);
    expect(resolveRepositoryRoot({ cwd: nested })).toEqual({
      ok: true,
      root: repo,
    });
  });

  it('accepts a .git file, as a worktree has', async () => {
    const repo = join(base, 'worktree');
    await mkdir(repo, { recursive: true });
    await writeFile(join(repo, '.git'), 'gitdir: /elsewhere\n');

    expect(findRepositoryRoot(repo)).toBe(repo);
  });

  it('prefers NOESIS_ROOT when set, and refuses one that is not a directory', async () => {
    const explicit = join(base, 'explicit');
    await mkdir(explicit);

    expect(resolveRepositoryRoot({ root: explicit, cwd: base })).toEqual({
      ok: true,
      root: explicit,
    });

    const missing = resolveRepositoryRoot({
      root: join(base, 'nope'),
      cwd: base,
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.message).toContain('NOESIS_ROOT');
  });

  it('refuses to start outside a repository with a message naming the fix', async () => {
    const result = resolveRepositoryRoot({ cwd: base });

    // The temp dir may sit under a git checkout on a developer machine; only
    // assert the shape of the refusal when it is not.
    if (result.ok) return;
    expect(result.message).toContain('NOESIS_ROOT');
  });
});
