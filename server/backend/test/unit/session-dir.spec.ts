import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SESSION_MAX_AGE_MS,
  SessionDir,
} from '#backend/adapters/in/mcp/session-dir';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const DAY_MS = 24 * 60 * 60 * 1000;

let root: string;
let noesis: NoesisDir;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-session-'));
  noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function leftover(name: string, ageMs: number): Promise<string> {
  const dir = noesis.resolve('sessions', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'draft.json'), '{}');
  const when = new Date(Date.now() - ageMs);
  await utimes(dir, when, when);
  return dir;
}

describe('SessionDir', () => {
  it('creates its own directory under .noesis/sessions/ on open', async () => {
    const session = new SessionDir(noesis, { id: 'abc' });

    await session.open();

    expect(session.path).toBe(join(root, '.noesis', 'sessions', 'abc'));
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
    await mkdir(noesis.resolve('sessions'), { recursive: true });
    const stray = noesis.resolve('sessions', 'notes.txt');
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
});
