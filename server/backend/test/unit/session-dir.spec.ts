import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  SESSION_MAX_AGE_MS,
  SessionDir,
} from '#backend/platform/files/session-dir';

const DAY_MS = 24 * 60 * 60 * 1000;

let root: string;
let noesis: NoesisDir;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-session-'));
  noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
});

afterEach(() => rm(root, { recursive: true, force: true }));

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function leftover(name: string, ageMs: number): Promise<string> {
  const dir = noesis.resolve('tmp', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'draft.json'), '{}');
  const when = new Date(Date.now() - ageMs);
  await utimes(dir, when, when);
  return dir;
}

describe('SessionDir', () => {
  it('creates its own directory under .noesis/tmp/ on open', async () => {
    const session = new SessionDir(noesis, { id: 'abc' });

    await session.open();

    expect(session.path).toBe(join(root, '.noesis', 'tmp', 'abc'));
    expect(await exists(session.path)).toBe(true);
  });

  it('sweeps directories older than the max age, keeps younger ones and its own', async () => {
    const old = await leftover('old', SESSION_MAX_AGE_MS + DAY_MS);
    const young = await leftover('young', DAY_MS);
    const session = new SessionDir(noesis, { id: 'me' });

    await session.open();

    expect(await exists(old)).toBe(false);
    expect(await exists(young)).toBe(true);
    expect(await exists(session.path)).toBe(true);
  });

  it('never sweeps a file that is not a session directory', async () => {
    await mkdir(noesis.resolve('tmp'), { recursive: true });
    const stray = noesis.resolve('tmp', 'notes.txt');
    await writeFile(stray, 'keep');
    const when = new Date(Date.now() - SESSION_MAX_AGE_MS * 2);
    await utimes(stray, when, when);

    await new SessionDir(noesis).open();

    expect(await exists(stray)).toBe(true);
  });

  it('removes only its own directory on dispose', async () => {
    const other = await leftover('other', 0);
    const session = new SessionDir(noesis);
    await session.open();
    await writeFile(join(session.path, 'work.json'), '{}');

    await session.dispose();

    expect(await exists(session.path)).toBe(false);
    expect(await exists(other)).toBe(true);
  });

  describe('resolveWorkingPath', () => {
    let session: SessionDir;
    let file: string;

    beforeEach(async () => {
      session = new SessionDir(noesis, { id: 's1' });
      await session.open();
      file = join(session.path, 'doc.json');
      await writeFile(file, '{}');
    });

    it('accepts an absolute path under tmp/', async () => {
      expect(await session.resolveWorkingPath(file)).toEqual({
        ok: true,
        path: file,
      });
    });

    it('accepts a path relative to the repository root', async () => {
      expect(await session.resolveWorkingPath(relative(root, file))).toEqual({
        ok: true,
        path: file,
      });
    });

    it("accepts another session's file — skills need not know the id", async () => {
      const other = await leftover('s2', 0);
      const result = await session.resolveWorkingPath(
        join(other, 'draft.json'),
      );
      expect(result.ok).toBe(true);
    });

    it('refuses a path outside tmp/, naming the session directory', async () => {
      const outside = join(root, '.noesis', 'doc.json');
      await writeFile(outside, '{}');

      const result = await session.resolveWorkingPath(outside);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('.noesis/tmp/');
        expect(result.message).toContain(session.path);
      }
    });

    it('refuses a path that climbs out of tmp/ with ..', async () => {
      const result = await session.resolveWorkingPath(
        join('.noesis', 'tmp', 's1', '..', '..', '.gitignore'),
      );
      expect(result.ok).toBe(false);
    });

    it('refuses the tmp/ directory itself', async () => {
      const result = await session.resolveWorkingPath(session.tmpRoot);
      expect(result.ok).toBe(false);
    });

    it('follows a symlink and refuses one that leaves tmp/', async () => {
      const target = join(root, 'secret.json');
      await writeFile(target, '{}');
      const link = join(session.path, 'link.json');
      await symlink(target, link);

      const result = await session.resolveWorkingPath(link);

      expect(result.ok).toBe(false);
    });

    it('reports a missing file', async () => {
      const result = await session.resolveWorkingPath(
        join(session.path, 'nope.json'),
      );
      expect(result).toEqual({
        ok: false,
        message: `No file at ${join(session.path, 'nope.json')}.`,
      });
    });
  });

  describe('deliver', () => {
    it('returns a small result inline', async () => {
      const session = new SessionDir(noesis, { inlineResultLimit: 100 });
      await session.open();

      expect(await session.deliver('short')).toBe('short');
    });

    it('writes a large result to the session directory and returns the path', async () => {
      const session = new SessionDir(noesis, { inlineResultLimit: 10 });
      await session.open();
      const big = 'x'.repeat(50);

      const answer = await session.deliver(big);

      const file = join(session.path, 'result-1.txt');
      expect(answer).toContain(file);
      expect(answer).toContain('50 bytes');
      expect(await readFile(file, 'utf8')).toBe(big);
      expect(await session.deliver(big)).toContain('result-2.txt');
    });
  });
});
