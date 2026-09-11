import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NoesisDir } from '../../src/files/noesis-dir.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-root-'));
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('NoesisDir', () => {
  it('creates .noesis/ with a .gitignore that ignores tmp/ on first run', async () => {
    const noesis = new NoesisDir(root);

    await noesis.ensure();

    expect(noesis.path).toBe(join(root, '.noesis'));
    expect(await readFile(join(root, '.noesis', '.gitignore'), 'utf8')).toBe(
      'tmp/\n',
    );
  });

  it('leaves an existing .gitignore alone', async () => {
    const noesis = new NoesisDir(root);
    await noesis.ensure();
    await writeFile(noesis.resolve('.gitignore'), 'tmp/\nscratch/\n');

    await noesis.ensure();

    expect(await readFile(noesis.resolve('.gitignore'), 'utf8')).toBe(
      'tmp/\nscratch/\n',
    );
  });

  it('resolves paths under .noesis/', () => {
    const noesis = new NoesisDir(root);
    expect(noesis.resolve('changes', 'x', 'design-docs')).toBe(
      join(root, '.noesis', 'changes', 'x', 'design-docs'),
    );
  });
});
