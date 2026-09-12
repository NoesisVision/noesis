// Packs the real npm tarball (`prepack` builds the bin and the ui) and verifies
// the publish invariants bunx depends on: the self-contained dist/main.js bin
// with a bun shebang, the built ui beside it, no readable contracts copy
// (decision 70), and a manifest whose only dependency is the native
// @ladybugdb/core (the @repo/* workspace deps are private — leaking them
// would break every `bunx @noesis-vision/noesis` install).
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = fileURLToPath(new URL('../../', import.meta.url));

let workDir: string;

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

test('the packed tarball is bunx-installable: one bin, the ui, one native dep', async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-service-pack-'));

  const pack = spawnSync('bun', ['pm', 'pack', '--destination', workDir], {
    cwd: serviceRoot,
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
  expect(shipped).toContain('LICENSE');
  expect(shipped).toContain('README.md');
  expect(shipped).toContain('dist/main.js');
  expect(shipped).toContain('ui/index.html');
  expect(shipped.filter((f) => f.startsWith('contracts/'))).toEqual([]);
  expect(shipped.filter((f) => f.endsWith('.spec.ts'))).toEqual([]);
  expect(shipped.filter((f) => f.startsWith('src/'))).toEqual([]);
  expect(shipped.filter((f) => f.startsWith('test/'))).toEqual([]);

  const manifest = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  expect(Object.keys(manifest.dependencies as object)).toEqual([
    '@ladybugdb/core',
  ]);
  expect(manifest.trustedDependencies).toEqual(['@ladybugdb/core']);
  expect(manifest.bin).toEqual({ noesis: 'dist/main.js' });
  expect(JSON.stringify(manifest)).not.toContain('workspace:');
  expect(JSON.stringify(manifest)).not.toContain('catalog:');

  const bin = await readFile(join(packageDir, 'dist', 'main.js'), 'utf8');
  expect(bin.startsWith('#!/usr/bin/env bun\n')).toBe(true);
}, 120_000);
