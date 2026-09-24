import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { JsonCollection } from '#backend/platform/files/json-collection';
import { JsonFileError } from '#backend/platform/files/json-file';

const NoteSchema = z.strictObject({ id: z.string(), text: z.string() });
type Note = z.infer<typeof NoteSchema>;

let dir: string;
let notes: JsonCollection<Note>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-json-collection-'));
  notes = new JsonCollection(NoteSchema, join(dir, 'notes'), 'note');
});

afterEach(() => rm(dir, { recursive: true, force: true }));

const note = (id: string, text = id): Note => ({ id, text });

async function writeRaw(name: string, content: unknown): Promise<void> {
  await mkdir(join(dir, 'notes'), { recursive: true });
  await writeFile(join(dir, 'notes', name), JSON.stringify(content));
}

describe('JsonCollection', () => {
  it('lists nothing while its directory does not exist', async () => {
    expect(await notes.list()).toEqual([]);
    expect(await notes.get('a')).toBeNull();
  });

  it('saves each entity as <dir>/<id>.<kind>.json and reads it back', async () => {
    await notes.save(note('2026-09-24-first', 'hello'));

    expect(await readdir(join(dir, 'notes'))).toEqual([
      '2026-09-24-first.note.json',
    ]);
    expect(notes.pathOf('2026-09-24-first')).toBe(
      join(dir, 'notes', '2026-09-24-first.note.json'),
    );
    expect(await notes.get('2026-09-24-first')).toEqual(
      note('2026-09-24-first', 'hello'),
    );
  });

  it('lists by id ascending', async () => {
    for (const id of ['2026-09-25-b', '2026-09-24-c', '2026-09-26-a']) {
      await notes.save(note(id));
    }

    expect((await notes.list()).map(({ id }) => id)).toEqual([
      '2026-09-24-c',
      '2026-09-25-b',
      '2026-09-26-a',
    ]);
  });

  it('lists only files of its own kind, never temp files', async () => {
    await notes.save(note('a'));
    await writeRaw('b.other.json', note('b'));
    await writeRaw('c.note.json.abc123.tmp', note('c'));
    await mkdir(join(dir, 'notes', 'a'));

    expect(await notes.list()).toEqual([note('a')]);
  });

  it('skips a listed file that is gone by the time it is read', async () => {
    await notes.save(note('a'));
    await symlink(
      join(dir, 'nowhere.json'),
      join(dir, 'notes', 'gone.note.json'),
    );

    expect(await notes.list()).toEqual([note('a')]);
    expect(await notes.get('gone')).toBeNull();
  });

  it('throws from list() and get() on broken JSON', async () => {
    await notes.save(note('a'));
    await mkdir(join(dir, 'notes'), { recursive: true });
    await writeFile(join(dir, 'notes', 'b.note.json'), '{ "id": ');

    await expect(notes.list()).rejects.toBeInstanceOf(JsonFileError);
    await expect(notes.get('b')).rejects.toThrow('Unreadable JSON');
  });

  it('throws on a file the schema rejects, naming its path', async () => {
    await writeRaw('a.note.json', { id: 'a' });

    const error = await notes.get('a').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(JsonFileError);
    expect((error as JsonFileError).path).toBe(notes.pathOf('a'));
    expect((error as JsonFileError).message).toContain('→ at text');
  });

  it('throws on a file whose id does not match its name', async () => {
    await writeRaw('a.note.json', note('b'));

    await expect(notes.get('a')).rejects.toThrow('does not match');
    await expect(notes.list()).rejects.toBeInstanceOf(JsonFileError);
  });

  it('throws on a listed file whose name is not an id', async () => {
    await writeRaw('Not An Id.note.json', note('Not An Id'));

    await expect(notes.list()).rejects.toBeInstanceOf(JsonFileError);
  });

  it('refuses an id that could name a path, before touching the disk', async () => {
    for (const id of ['../escape', 'a/b', '', 'Upper', '-leading', '.']) {
      expect(() => notes.pathOf(id)).toThrow('Invalid id');
      await expect(notes.get(id)).rejects.toThrow('Invalid id');
      await expect(notes.delete(id)).rejects.toThrow('Invalid id');
      await expect(notes.save(note(id))).rejects.toThrow('Invalid id');
    }
    expect(await Bun.file(join(dir, 'escape.note.json')).exists()).toBe(false);
  });

  it('accepts a content-hash id', async () => {
    const id = 'a3f1c2d4-0b9e-47aa-8c11-5e6f7a8b9c0d';
    await notes.save(note(id));

    expect(await notes.get(id)).toEqual(note(id));
  });

  it('deletes a file, answering whether there was one', async () => {
    await notes.save(note('a'));

    expect(await notes.delete('a')).toBe(true);
    expect(await notes.delete('a')).toBe(false);
    expect(await notes.list()).toEqual([]);
  });
});
