// Packs the real npm tarball (bin built fresh) and verifies the publish
// invariants bunx depends on: only the self-contained dist/main.js ships, the
// manifest carries NO dependencies (the @repo/* workspace deps are private —
// leaking them would break every `bunx @noesis-vision/mcp-bridge` install),
// and the bin starts with a bun shebang.
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bridgeRoot = fileURLToPath(new URL('../../', import.meta.url));

let workDir: string;

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

test('the packed tarball is bunx-installable: one self-contained bin, no deps', async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-bridge-pack-'));

  const build = spawnSync('bun', ['run', 'build'], {
    cwd: bridgeRoot,
    encoding: 'utf8',
  });
  expect(build.status).toBe(0);

  const pack = spawnSync('bun', ['pm', 'pack', '--destination', workDir], {
    cwd: bridgeRoot,
    encoding: 'utf8',
  });
  expect(pack.status).toBe(0);

  const tarball = (await readdir(workDir)).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('bun pm pack produced no tarball');
  const extract = spawnSync(
    'tar',
    ['-xzf', join(workDir, tarball), '-C', workDir],
    { encoding: 'utf8' },
  );
  expect(extract.status).toBe(0);
  const packageDir = join(workDir, 'package');

  const shipped = (
    await readdir(packageDir, { recursive: true, withFileTypes: true })
  )
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath.slice(packageDir.length + 1), e.name))
    .sort();
  expect(shipped).toEqual([
    'LICENSE',
    'README.md',
    'dist/main.js',
    'package.json',
  ]);

  const manifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  expect(manifest.dependencies).toBeUndefined();
  expect(manifest.bin).toEqual({ 'noesis-mcp-bridge': 'dist/main.js' });

  const bin = await readFile(join(packageDir, 'dist', 'main.js'), 'utf8');
  expect(bin.startsWith('#!/usr/bin/env bun\n')).toBe(true);
}, 60_000);
