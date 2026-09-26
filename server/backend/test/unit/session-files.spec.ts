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
import { SessionDir } from '#backend/adapters/in/mcp/session-dir';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { WorkingFileError } from '#backend/adapters/in/mcp/working-file-error';
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

/** Why the path was refused; throws when it was accepted. */
async function refusal(resolve: Promise<unknown>): Promise<WorkingFileError> {
  try {
    await resolve;
  } catch (error) {
    if (error instanceof WorkingFileError) return error;
    throw error;
  }
  throw new Error('expected the path to be refused');
}

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
    expect(await files.resolve('doc', file)).toBe<string>(await realpath(file));
  });

  it('accepts a path relative to the repository root', async () => {
    expect(await files.resolve('doc', relative(root, file))).toBe<string>(
      await realpath(file),
    );
  });

  it("accepts another session's file — skills need not know the id", async () => {
    await expect(
      files.resolve('doc', await otherSessionFile('s2')),
    ).resolves.toBeDefined();
  });

  it('refuses a path outside sessions/, naming the session directory', async () => {
    const outside = join(root, '.noesis', 'doc.json');
    await writeFile(outside, '{}');

    const { subject, reason } = await refusal(files.resolve('doc', outside));

    expect(subject).toBe('doc');
    expect(reason).toContain('.noesis/sessions/');
    expect(reason).toContain(files.dir);
  });

  it('refuses a path that climbs out of sessions/ with ..', async () => {
    await expect(
      files.resolve(
        'doc',
        join('.noesis', 'sessions', 's1', '..', '..', '.gitignore'),
      ),
    ).rejects.toBeInstanceOf(WorkingFileError);
  });

  it('refuses the sessions/ directory itself', async () => {
    await expect(
      files.resolve('doc', files.sessionsRoot),
    ).rejects.toBeInstanceOf(WorkingFileError);
  });

  it('follows a symlink and refuses one that leaves sessions/', async () => {
    const target = join(root, 'secret.json');
    await writeFile(target, '{}');
    const link = join(files.dir, 'link.json');
    await symlink(target, link);

    await expect(files.resolve('doc', link)).rejects.toBeInstanceOf(
      WorkingFileError,
    );
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

    expect(await linked.resolve('doc', resolved)).toBe<string>(resolved);
  });

  it('answers the path it checked, not the link it was given', async () => {
    const link = join(files.dir, 'link.json');
    await symlink(file, link);

    expect(await files.resolve('doc', link)).toBe<string>(await realpath(file));
  });

  it('accepts a file whose name merely starts with two dots', async () => {
    const dotted = join(files.dir, '..draft.json');
    await writeFile(dotted, '{}');

    await expect(files.resolve('doc', dotted)).resolves.toBeDefined();
  });

  it('reports a missing file', async () => {
    const missing = join(files.dir, 'nope.json');

    const { reason } = await refusal(files.resolve('doc', missing));

    expect(reason).toStartWith(`No file at ${missing}.`);
    expect(reason).toContain(files.dir);
  });
});
