// Packs the real npm tarball (`prepack` builds dist/) and verifies the publish
// invariants bunx depends on: the self-contained dist/main.js bin with a bun
// shebang, the browser app's page and assets beside it, no readable contracts
// copy (decision D4), and a manifest whose only dependency is the native
// @ladybugdb/core (the @repo/* workspace deps are private — leaking them
// would break every `bunx @noesis-vision/noesis` install). Then boots the
// packed bin from another directory, the way bunx does, and fetches the page:
// bun resolves the bundle manifest against the working directory, and
// src/bundle-cwd.ts is what makes that work.
import { afterAll, expect, test } from 'bun:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listeningUrl, serviceEnv } from '../support/service-process.js';

const serviceRoot = fileURLToPath(new URL('../../', import.meta.url));

let workDir: string;
let packageDir: string;

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
  packageDir = join(workDir, 'package');

  const shipped = (
    await readdir(packageDir, { recursive: true, withFileTypes: true })
  )
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath.slice(packageDir.length + 1), e.name))
    .sort();
  expect(shipped).toContain('LICENSE');
  expect(shipped).toContain('README.md');
  expect(shipped).toContain('dist/main.js');
  expect(shipped).toContain('dist/index.html');
  expect(shipped.some((f) => /^dist\/index-\w+\.js$/.test(f))).toBe(true);
  expect(shipped.some((f) => /^dist\/index-\w+\.css$/.test(f))).toBe(true);
  expect(shipped.filter((f) => f.startsWith('ui/'))).toEqual([]);
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

test('the packed bin serves the page when launched from another directory', async () => {
  const projectDir = join(workDir, 'project');
  await mkdir(projectDir, { recursive: true });
  // The bin built by prepack, from the workspace: the extracted tarball has no
  // node_modules, and installing it needs the network.
  const child = spawn('bun', [join(serviceRoot, 'dist', 'main.js')], {
    cwd: projectDir,
    env: serviceEnv(projectDir),
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  try {
    const base = await listeningUrl(child, 15_000);
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<title>Noesis</title>');
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    const asset = await fetch(`${base}${script}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
  } finally {
    child.kill();
  }
}, 60_000);
