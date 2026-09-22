import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { err, ok } from 'neverthrow';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  SESSION_MAX_AGE_MS,
  SessionDir,
} from '#backend/platform/files/session-dir';

const DAY_MS = 24 * 60 * 60 * 1000;

let root: string;
let noesis: NoesisDir;
/** Directories a single test makes outside the repository root. */
let extra: string[] = [];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-session-'));
  noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
});

afterEach(async () => {
  for (const dir of [root, ...extra]) {
    await rm(dir, { recursive: true, force: true });
  }
  extra = [];
});

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
    const session = new SessionDir(noesis, root, { id: 'abc' });

    await session.open();

    expect(session.path).toBe(join(root, '.noesis', 'tmp', 'abc'));
    expect(await exists(session.path)).toBe(true);
  });

  it('sweeps directories older than the max age, keeps younger ones and its own', async () => {
    const old = await leftover('old', SESSION_MAX_AGE_MS + DAY_MS);
    const young = await leftover('young', DAY_MS);
    const session = new SessionDir(noesis, root, { id: 'me' });

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

    await new SessionDir(noesis, root).open();

    expect(await exists(stray)).toBe(true);
  });

  it('removes only its own directory on dispose', async () => {
    const other = await leftover('other', 0);
    const session = new SessionDir(noesis, root);
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
      session = new SessionDir(noesis, root, { id: 's1' });
      await session.open();
      file = join(session.path, 'doc.json');
      await writeFile(file, '{}');
    });

    it('accepts an absolute path under tmp/', async () => {
      expect(await session.resolveWorkingPath(file)).toEqual(
        ok(await realpath(file)),
      );
    });

    it('accepts a path relative to the repository root', async () => {
      expect(await session.resolveWorkingPath(relative(root, file))).toEqual(
        ok(await realpath(file)),
      );
    });

    it("accepts another session's file — skills need not know the id", async () => {
      const other = await leftover('s2', 0);
      const result = await session.resolveWorkingPath(
        join(other, 'draft.json'),
      );
      expect(result.isOk()).toBe(true);
    });

    it('refuses a path outside tmp/, naming the session directory', async () => {
      const outside = join(root, '.noesis', 'doc.json');
      await writeFile(outside, '{}');

      const result = await session.resolveWorkingPath(outside);

      expect(result.isErr()).toBe(true);
      const message = result._unsafeUnwrapErr();
      expect(message).toContain('.noesis/tmp/');
      expect(message).toContain(session.path);
    });

    it('refuses a path that climbs out of tmp/ with ..', async () => {
      const result = await session.resolveWorkingPath(
        join('.noesis', 'tmp', 's1', '..', '..', '.gitignore'),
      );
      expect(result.isErr()).toBe(true);
    });

    it('refuses the tmp/ directory itself', async () => {
      const result = await session.resolveWorkingPath(session.tmpRoot);
      expect(result.isErr()).toBe(true);
    });

    it('follows a symlink and refuses one that leaves tmp/', async () => {
      const target = join(root, 'secret.json');
      await writeFile(target, '{}');
      const link = join(session.path, 'link.json');
      await symlink(target, link);

      const result = await session.resolveWorkingPath(link);

      expect(result.isErr()).toBe(true);
    });

    it('accepts the resolved spelling when the repository root is a symlink', async () => {
      const parent = await mkdtemp(join(tmpdir(), 'noesis-link-'));
      extra.push(parent);
      const link = join(parent, 'repo');
      await symlink(root, link);
      const linked = new SessionDir(new NoesisDir(link), link, { id: 's3' });
      await linked.open();
      const resolved = join(await realpath(linked.path), 'doc.json');
      await writeFile(resolved, '{}');

      expect(await linked.resolveWorkingPath(resolved)).toEqual(ok(resolved));
    });

    it('answers the path it checked, not the link it was given', async () => {
      const link = join(session.path, 'link.json');
      await symlink(file, link);

      expect(await session.resolveWorkingPath(link)).toEqual(
        ok(await realpath(file)),
      );
    });

    it('accepts a file whose name merely starts with two dots', async () => {
      const dotted = join(session.path, '..draft.json');
      await writeFile(dotted, '{}');

      const result = await session.resolveWorkingPath(dotted);

      expect(result.isOk()).toBe(true);
    });

    it('reports a missing file', async () => {
      const result = await session.resolveWorkingPath(
        join(session.path, 'nope.json'),
      );
      expect(result).toEqual(
        err(`No file at ${join(session.path, 'nope.json')}.`),
      );
    });
  });
});
