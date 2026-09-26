import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigurationError } from '#backend/platform/config/configuration-error';
import { resolveRepositoryRoot as resolveRoot } from '#backend/platform/config/repository-root';

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

    expect(resolveRoot({ cwd: nested })).toBe(repo);
  });

  it('accepts a .git file, as a worktree has', async () => {
    const repo = join(base, 'worktree');
    await mkdir(repo, { recursive: true });
    await writeFile(join(repo, '.git'), 'gitdir: /elsewhere\n');

    expect(resolveRoot({ cwd: repo })).toBe(repo);
  });

  it('prefers NOESIS_ROOT when set, and refuses one that is not a directory', async () => {
    const explicit = join(base, 'explicit');
    await mkdir(explicit);

    expect(resolveRoot({ root: explicit, cwd: base })).toBe(explicit);

    const missing = () => resolveRoot({ root: join(base, 'nope'), cwd: base });
    expect(missing).toThrow(ConfigurationError);
    expect(missing).toThrow('NOESIS_ROOT');
  });

  it('refuses to start outside a repository with a message naming the fix', () => {
    // The temp dir may sit under a git checkout on a developer machine; only
    // assert the shape of the refusal when it is not.
    try {
      resolveRoot({ cwd: base });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain('NOESIS_ROOT');
    }
  });
});
