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

  it('creates each entity as <dir>/<id>.<kind>.json and reads it back', async () => {
    await notes.create(note('2026-09-24-first', 'hello'));

    expect(await readdir(join(dir, 'notes'))).toEqual([
      '2026-09-24-first.note.json',
    ]);
    expect(await notes.get('2026-09-24-first')).toEqual(
      note('2026-09-24-first', 'hello'),
    );
  });

  it('lists by id ascending', async () => {
    for (const id of ['2026-09-25-b', '2026-09-24-c', '2026-09-26-a']) {
      await notes.create(note(id));
    }

    expect((await notes.list()).map(({ id }) => id)).toEqual([
      '2026-09-24-c',
      '2026-09-25-b',
      '2026-09-26-a',
    ]);
  });

  it('lists only files of its own kind, never temp files', async () => {
    await notes.create(note('a'));
    await writeRaw('b.other.json', note('b'));
    await writeRaw('c.note.json.abc123.tmp', note('c'));
    await mkdir(join(dir, 'notes', 'a'));

    expect(await notes.list()).toEqual([note('a')]);
  });

  it('skips a listed file that is gone by the time it is read', async () => {
    await notes.create(note('a'));
    await symlink(
      join(dir, 'nowhere.json'),
      join(dir, 'notes', 'gone.note.json'),
    );

    expect(await notes.list()).toEqual([note('a')]);
    expect(await notes.get('gone')).toBeNull();
  });

  it('throws from list() and get() on broken JSON', async () => {
    await notes.create(note('a'));
    await mkdir(join(dir, 'notes'), { recursive: true });
    await writeFile(join(dir, 'notes', 'b.note.json'), '{ "id": ');

    await expect(notes.list()).rejects.toBeInstanceOf(JsonFileError);
    await expect(notes.get('b')).rejects.toThrow('Unreadable JSON');
  });

  it('throws on a file the schema rejects, naming its path', async () => {
    await writeRaw('a.note.json', { id: 'a' });

    const error = await notes.get('a').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(JsonFileError);
    expect((error as JsonFileError).path).toBe(
      join(dir, 'notes', 'a.note.json'),
    );
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
      await expect(notes.get(id)).rejects.toThrow('Invalid id');
      await expect(notes.create(note(id))).rejects.toThrow('Invalid id');
      await expect(notes.replace(note(id))).rejects.toThrow('Invalid id');
      await expect(notes.delete(id)).rejects.toThrow('Invalid id');
    }
    expect(await readdir(dir)).toEqual([]);
  });

  it('creates only where no file is, leaving a taken one as it was', async () => {
    expect(await notes.create(note('a', 'first'))).toBe(true);

    expect(await notes.create(note('a', 'second'))).toBe(false);
    expect(await notes.get('a')).toEqual(note('a', 'first'));
    expect(await readdir(join(dir, 'notes'))).toEqual(['a.note.json']);
  });

  it('lets one of many creates of one id win, across collections too', async () => {
    const other = new JsonCollection(NoteSchema, join(dir, 'notes'), 'note');

    const created = await Promise.all(
      [notes, other, notes, other].map((collection, n) =>
        collection.create(note('a', `writer ${n}`)),
      ),
    );

    expect(created.filter(Boolean)).toHaveLength(1);
    expect(await readdir(join(dir, 'notes'))).toEqual(['a.note.json']);
  });

  it('replaces only an entity that is there', async () => {
    await notes.create(note('a', 'first'));

    expect(await notes.replace(note('a', 'revised'))).toBe(true);
    expect(await notes.replace(note('b'))).toBe(false);
    expect(await notes.list()).toEqual([note('a', 'revised')]);
  });

  it('deletes an entity by removing its file, the others staying', async () => {
    await notes.create(note('2026-09-24-first'));
    await notes.create(note('2026-09-24-second'));

    expect(await notes.delete('2026-09-24-first')).toBe(true);

    expect(await notes.get('2026-09-24-first')).toBeNull();
    expect(await notes.list()).toEqual([note('2026-09-24-second')]);
  });

  it('answers false for deleting an entity that is not there', async () => {
    expect(await notes.delete('2026-09-24-never-saved')).toBe(false);

    expect(await notes.list()).toEqual([]);
  });

  it('never lets a replace beside a delete bring the entity back', async () => {
    await notes.create(note('a'));

    const [deleted, replaced] = await Promise.all([
      notes.delete('a'),
      notes.replace(note('a', 'revised')),
    ]);

    expect([deleted, replaced]).toEqual([true, false]);
    expect(await notes.list()).toEqual([]);
  });

  it('accepts a content-hash id', async () => {
    const id = 'a3f1c2d4-0b9e-47aa-8c11-5e6f7a8b9c0d';
    await notes.create(note(id));

    expect(await notes.get(id)).toEqual(note(id));
  });
});
