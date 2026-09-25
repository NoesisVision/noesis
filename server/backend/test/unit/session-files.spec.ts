import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { err } from 'neverthrow';
import { SessionDir } from '#backend/adapters/mcp/session-dir';
import type { SessionFiles } from '#backend/adapters/mcp/session-files';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

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

/** A file another session wrote. */
async function otherSessionFile(session: string): Promise<string> {
  const dir = noesis.resolve('sessions', session);
  await mkdir(dir, { recursive: true });
  const file = join(dir, 'draft.json');
  await writeFile(file, '{}');
  return file;
}

describe('SessionFiles.resolve', () => {
  let files: SessionFiles;
  let file: string;

  beforeEach(async () => {
    files = await new SessionDir(noesis, { id: 's1' }).open();
    file = join(files.dir, 'doc.json');
    await writeFile(file, '{}');
  });

  it('accepts an absolute path under sessions/', async () => {
    expect((await files.resolve(file))._unsafeUnwrap()).toBe<string>(
      await realpath(file),
    );
  });

  it('accepts a path relative to the repository root', async () => {
    expect(
      (await files.resolve(relative(root, file)))._unsafeUnwrap(),
    ).toBe<string>(await realpath(file));
  });

  it("accepts another session's file — skills need not know the id", async () => {
    const result = await files.resolve(await otherSessionFile('s2'));
    expect(result.isOk()).toBe(true);
  });

  it('refuses a path outside sessions/, naming the session directory', async () => {
    const outside = join(root, '.noesis', 'doc.json');
    await writeFile(outside, '{}');

    const result = await files.resolve(outside);

    expect(result.isErr()).toBe(true);
    const message = result._unsafeUnwrapErr();
    expect(message).toContain('.noesis/sessions/');
    expect(message).toContain(files.dir);
  });

  it('refuses a path that climbs out of sessions/ with ..', async () => {
    const result = await files.resolve(
      join('.noesis', 'sessions', 's1', '..', '..', '.gitignore'),
    );
    expect(result.isErr()).toBe(true);
  });

  it('refuses the sessions/ directory itself', async () => {
    const result = await files.resolve(files.sessionsRoot);
    expect(result.isErr()).toBe(true);
  });

  it('follows a symlink and refuses one that leaves sessions/', async () => {
    const target = join(root, 'secret.json');
    await writeFile(target, '{}');
    const link = join(files.dir, 'link.json');
    await symlink(target, link);

    const result = await files.resolve(link);

    expect(result.isErr()).toBe(true);
  });

  it('accepts the resolved spelling when the repository root is a symlink', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'noesis-link-'));
    extra.push(parent);
    const link = join(parent, 'repo');
    await symlink(root, link);
    const linked = await new SessionDir(new NoesisDir(link), {
      id: 's3',
    }).open();
    const resolved = join(await realpath(linked.dir), 'doc.json');
    await writeFile(resolved, '{}');

    expect((await linked.resolve(resolved))._unsafeUnwrap()).toBe<string>(
      resolved,
    );
  });

  it('answers the path it checked, not the link it was given', async () => {
    const link = join(files.dir, 'link.json');
    await symlink(file, link);

    expect((await files.resolve(link))._unsafeUnwrap()).toBe<string>(
      await realpath(file),
    );
  });

  it('accepts a file whose name merely starts with two dots', async () => {
    const dotted = join(files.dir, '..draft.json');
    await writeFile(dotted, '{}');

    const result = await files.resolve(dotted);

    expect(result.isOk()).toBe(true);
  });

  it('reports a missing file', async () => {
    const result = await files.resolve(join(files.dir, 'nope.json'));
    expect(result).toEqual(err(`No file at ${join(files.dir, 'nope.json')}.`));
  });
});
