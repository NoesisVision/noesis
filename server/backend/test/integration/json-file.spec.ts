import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  JsonFileError,
  readJsonFile,
  writeJsonFile,
} from '#backend/platform/files/json-file';

const schema = z.strictObject({
  id: z.string(),
  tags: z.array(z.string()).default([]),
  size: z.codec(z.string().regex(/^\d+$/), z.number(), {
    decode: Number,
    encode: String,
  }),
});

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-json-file-'));
});

afterEach(() => rm(dir, { recursive: true, force: true }));

describe('readJsonFile', () => {
  it('decodes a valid file', async () => {
    const path = join(dir, 'a.json');
    await writeFile(path, '{ "id": "a", "size": "3" }');

    const value = (await readJsonFile(path, schema))._unsafeUnwrap();

    expect(value.tags).toEqual([]);
    expect(value.size).toBe(3);
  });

  it('answers a missing file as unreadable, never null', async () => {
    const result = await readJsonFile(join(dir, 'missing.json'), schema);
    expect(result._unsafeUnwrapErr()).toStartWith('Unreadable JSON:');
  });

  it('answers broken JSON as unreadable', async () => {
    const path = join(dir, 'broken.json');
    await writeFile(path, '{ "id": ');

    const result = await readJsonFile(path, schema);

    expect(result._unsafeUnwrapErr()).toStartWith('Unreadable JSON:');
  });

  it('names each schema issue with its path', async () => {
    const path = join(dir, 'wrong.json');
    await writeFile(path, '{ "id": 1, "size": "3" }');

    const message = (await readJsonFile(path, schema))._unsafeUnwrapErr();

    expect(message).toContain('expected string');
    expect(message).toContain('→ at id');
  });

  it('caps the issues and counts the rest', async () => {
    const path = join(dir, 'many.json');
    const tags = Array.from({ length: 25 }, (_, index) => index);
    await writeFile(path, JSON.stringify({ id: 'a', size: '3', tags }));

    const message = (await readJsonFile(path, schema))._unsafeUnwrapErr();

    expect(message.match(/✖/g)).toHaveLength(20);
    expect(message).toEndWith('… and 5 more');
  });
});

describe('writeJsonFile', () => {
  it('writes the encoded value as pretty JSON with a trailing newline, creating the directory', async () => {
    const path = join(dir, 'nested', 'deeper', 'a.json');

    await writeJsonFile(path, schema, { id: 'a', tags: [], size: 3 });

    expect(await readFile(path, 'utf8')).toBe(
      `${JSON.stringify({ id: 'a', tags: [], size: '3' }, null, 2)}\n`,
    );
  });

  it('leaves no temp file behind', async () => {
    const path = join(dir, 'a.json');

    await writeJsonFile(path, schema, { id: 'a', tags: [], size: 3 });
    await writeJsonFile(path, schema, { id: 'a', tags: ['b'], size: 3 });

    expect(await readdir(dir)).toEqual(['a.json']);
  });

  it('refuses a value the schema rejects, writing nothing', async () => {
    const path = join(dir, 'a.json');
    const invalid = { id: 7 } as unknown as z.output<typeof schema>;

    const write = writeJsonFile(path, schema, invalid);

    await expect(write).rejects.toBeInstanceOf(JsonFileError);
    await expect(write).rejects.toThrow(path);
    expect(await Bun.file(path).exists()).toBe(false);
  });
});
