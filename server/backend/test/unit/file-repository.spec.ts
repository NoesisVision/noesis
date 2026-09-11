import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  FileRepository,
  fileNameFor,
  idSuffix,
  slugify,
} from '../../src/files/file-repository.js';

const NoteSchema = z.object({ id: z.string(), title: z.string() });
type Note = z.infer<typeof NoteSchema>;

let dir: string;
let notes: FileRepository<Note>;

beforeEach(async () => {
  dir = join(await mkdtemp(join(tmpdir(), 'noesis-files-')), 'notes');
  notes = new FileRepository<Note>({
    dir,
    slugOf: (note) => note.title,
    decode: (raw) => NoteSchema.parse(raw),
  });
});

afterEach(() => rm(join(dir, '..'), { recursive: true, force: true }));

const listing = () => readdir(dir).then((names) => names.sort());

describe('FileRepository', () => {
  it('writes <slug>-<id-suffix>.json, pretty-printed, and reads it back', async () => {
    const note = {
      id: '019a0c3e-0000-7000-8000-0123456789ab',
      title: 'Hello, World!',
    };

    const stored = await notes.write(note);

    expect(stored.path).toBe(join(dir, 'hello-world-0123456789ab.json'));
    expect(await listing()).toEqual(['hello-world-0123456789ab.json']);
    expect(await readFile(stored.path, 'utf8')).toBe(
      `${JSON.stringify(note, null, 2)}\n`,
    );
    expect(await notes.read(note.id)).toEqual(stored);
    expect(stored.hash).toHaveLength(64);
    expect(Date.parse(stored.updatedAt)).not.toBeNaN();
  });

  it('renames the file when the slug changes and leaves no temp file behind', async () => {
    await notes.write({ id: 'n1', title: 'First title' });

    await notes.write({ id: 'n1', title: 'Second title' });

    expect(await listing()).toEqual(['second-title-n1.json']);
    expect((await notes.read('n1'))?.entity.title).toBe('Second title');
  });

  it('lists only .json files and skips ones that do not decode', async () => {
    await notes.write({ id: 'n1', title: 'Kept' });
    await writeFile(join(dir, 'notes.md'), '# not graph content');
    await writeFile(join(dir, 'broken-n2.json'), '{ not json');
    await writeFile(join(dir, 'wrong-shape-n3.json'), '{"id":"n3"}');

    const listed = await notes.list();

    expect(listed.map((s) => s.entity)).toEqual([{ id: 'n1', title: 'Kept' }]);
  });

  it('answers an empty list and null for a directory that does not exist yet', async () => {
    expect(await notes.list()).toEqual([]);
    expect(await notes.read('nothing')).toBe(null);
    expect(await notes.remove('nothing')).toBe(false);
  });

  it('matches by the id inside the file, not just the suffix', async () => {
    await notes.write({ id: 'a-n1', title: 'A' });
    await notes.write({ id: 'b-n1', title: 'B' });

    expect((await notes.read('a-n1'))?.entity.title).toBe('A');
    expect((await notes.read('b-n1'))?.entity.title).toBe('B');
    expect(await notes.read('c-n1')).toBe(null);
  });

  it('removes a file and reports the second attempt as missing', async () => {
    await notes.write({ id: 'n1', title: 'Gone' });

    expect(await notes.remove('n1')).toBe(true);
    expect(await listing()).toEqual([]);
    expect(await notes.remove('n1')).toBe(false);
  });

  it('tells a fresh reference from a stale or missing one by the file hash', async () => {
    const stored = await notes.write({ id: 'n1', title: 'Version one' });
    const ref = { id: 'n1', hash: stored.hash };

    expect(await notes.check(ref)).toBe('fresh');

    await notes.write({ id: 'n1', title: 'Version two' });
    expect(await notes.check(ref)).toBe('stale');

    await notes.remove('n1');
    expect(await notes.check(ref)).toBe('missing');
  });
});

describe('file naming', () => {
  it('kebab-cases, strips accents, caps the slug and falls back to untitled', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  Crème brûlée  ')).toBe('creme-brulee');
    expect(slugify('---')).toBe('untitled');
    expect(slugify('x'.repeat(80))).toHaveLength(60);
    expect(slugify(`${'a'.repeat(59)} b`)).toBe('a'.repeat(59));
  });

  it('takes the tail of the id as the suffix', () => {
    expect(idSuffix('019a0c3e-0000-7000-8000-0123456789ab')).toBe(
      '0123456789ab',
    );
    expect(idSuffix('doc-old')).toBe('docold');
    expect(fileNameFor('doc-old', 'Older')).toBe('older-docold.json');
  });
});
