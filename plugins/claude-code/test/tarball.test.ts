// Packs the real npm tarball (server bundle built fresh) and verifies what
// ships: file whitelist, rewritten manifest, and — most importantly — that the
// bundled MCP server boots from the extracted tarball in an empty directory
// and answers an MCP handshake. Tests run in file order; the pack test seeds
// the state the rest assert on.
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));

let workDir: string;
let packageDir: string;

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

test('packs the npm tarball from a freshly built server bundle', async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-plugin-pack-'));

  const bundle = spawnSync('bun', ['run', 'bundle'], {
    cwd: pluginRoot,
    encoding: 'utf8',
  });
  expect(bundle.status).toBe(0);

  const pack = spawnSync('bun', ['pm', 'pack', '--destination', workDir], {
    cwd: pluginRoot,
    encoding: 'utf8',
  });
  expect(pack.status).toBe(0);

  const tarball = (await readdir(workDir)).find((f) => f.endsWith('.tgz'));
  expect(tarball).toBeDefined();

  const extract = spawnSync(
    'tar',
    ['-xzf', join(workDir, tarball!), '-C', workDir],
    { encoding: 'utf8' },
  );
  expect(extract.status).toBe(0);
  packageDir = join(workDir, 'package');
}, 60_000);

test('ships exactly the expected plugin files', async () => {
  const required = [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'LICENSE',
    'README.md',
    'contracts/index.ts',
    'contracts/registry.ts',
    'contracts/shared/index.ts',
    'scripts/validate.ts',
    'servers/noesis-local.js',
    'skills/prepare-mcp-data/SKILL.md',
    'skills/prepare-mcp-data/references/hello-request.schema.json',
    'skills/prepare-mcp-data/references/hello-request.example.json',
  ];
  const missing = required.filter((f) => !existsSync(join(packageDir, f)));
  expect(missing).toEqual([]);

  // The marketplace catalog points at the package — it must not ship inside it.
  // tools/ (dev/build tooling) and test/ are not part of the plugin either.
  const excluded = ['.claude-plugin/marketplace.json', 'tools', 'test'];
  const leaked = excluded.filter((f) => existsSync(join(packageDir, f)));
  expect(leaked).toEqual([]);
});

test('publishes a self-contained, version-consistent manifest', async () => {
  const packed = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  ) as { version: string };
  const source = JSON.parse(
    await readFile(join(pluginRoot, 'package.json'), 'utf8'),
  ) as { version: string };
  const pluginManifest = JSON.parse(
    await readFile(join(packageDir, '.claude-plugin/plugin.json'), 'utf8'),
  ) as { version: string };

  expect(packed.version).toBe(source.version);
  expect(pluginManifest.version).toBe(source.version);

  // bun pm pack must have rewritten workspace:*/catalog: specifiers — npm
  // consumers cannot resolve them.
  const raw = JSON.stringify(packed);
  expect(raw).not.toContain('workspace:');
  expect(raw).not.toContain('catalog:');
});

test('bundled MCP server boots from the extracted tarball and lists tools', async () => {
  const emptyDir = join(workDir, 'empty-cwd');
  await mkdir(emptyDir, { recursive: true });

  const transport = new StdioClientTransport({
    command: 'bun',
    args: [join(packageDir, 'servers', 'noesis-local.js')],
    cwd: emptyDir,
    stderr: 'ignore',
  });
  const client = new Client({ name: 'tarball-smoke-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('hello');
  } finally {
    await client.close();
  }
}, 30_000);
