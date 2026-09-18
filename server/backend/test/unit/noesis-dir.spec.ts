import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NoesisDir } from '../../src/infra/files/noesis-dir.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-root-'));
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('NoesisDir', () => {
  it('creates .noesis/, tmp/, logs/ and a .gitignore covering both on first run', async () => {
    const noesis = new NoesisDir(root);

    await noesis.ensure();

    expect(noesis.path).toBe(join(root, '.noesis'));
    expect(noesis.logDir).toBe(join(root, '.noesis', 'logs'));
    expect((await stat(noesis.resolve('tmp'))).isDirectory()).toBe(true);
    expect((await stat(noesis.logDir)).isDirectory()).toBe(true);
    expect(await readFile(join(root, '.noesis', '.gitignore'), 'utf8')).toBe(
      'tmp/\nlogs/\n',
    );
  });

  it('leaves a complete .gitignore alone', async () => {
    const noesis = new NoesisDir(root);
    await noesis.ensure();
    await writeFile(noesis.resolve('.gitignore'), 'tmp/\nlogs/\nscratch/\n');

    await noesis.ensure();

    expect(await readFile(noesis.resolve('.gitignore'), 'utf8')).toBe(
      'tmp/\nlogs/\nscratch/\n',
    );
  });

  it('adds the lines an older .gitignore lacks, keeping the rest', async () => {
    const noesis = new NoesisDir(root);
    await noesis.ensure();
    await writeFile(noesis.resolve('.gitignore'), 'tmp/\nscratch/');

    await noesis.ensure();

    expect(await readFile(noesis.resolve('.gitignore'), 'utf8')).toBe(
      'tmp/\nscratch/\nlogs/\n',
    );
  });

  it('resolves paths under .noesis/', () => {
    const noesis = new NoesisDir(root);
    expect(noesis.resolve('changes', 'x', 'design-docs')).toBe(
      join(root, '.noesis', 'changes', 'x', 'design-docs'),
    );
  });
});
