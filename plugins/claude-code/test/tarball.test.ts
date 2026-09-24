// Tests run in file order; the pack test seeds the state the rest assert on.
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const serviceRoot = fileURLToPath(
  new URL('../../../server/backend/', import.meta.url),
);

let workDir: string;
let packageDir: string;

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

test('packs the npm tarball', async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-plugin-pack-'));

  const pack = spawnSync('bun', ['pm', 'pack', '--destination', workDir], {
    cwd: pluginRoot,
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
}, 60_000);

test('ships exactly the expected plugin files', async () => {
  const required = [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'LICENSE',
    'README.md',
    'contracts/README.md',
    'contracts/design-document.schema.json',
    'contracts/document.schema.json',
    'contracts/change.schema.json',
    'skills/add-document-to-change/SKILL.md',
    'skills/add-document-to-change/scripts/write-working-file.ts',
    'skills/add-change/SKILL.md',
    'scripts/entity-id.ts',
  ];
  const missing = required.filter((f) => !existsSync(join(packageDir, f)));
  expect(missing).toEqual([]);

  // The marketplace catalog points at the package — it must not ship inside it.
  const excluded = [
    '.claude-plugin/marketplace.json',
    'tools',
    'test',
    'servers',
  ];
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

test('.mcp.json launches the service bin pinned to the plugin version', async () => {
  const { version } = JSON.parse(
    await readFile(join(pluginRoot, 'package.json'), 'utf8'),
  ) as { version: string };
  const mcp = JSON.parse(
    await readFile(join(packageDir, '.mcp.json'), 'utf8'),
  ) as {
    mcpServers: Record<
      string,
      { command: string; args: string[]; env: Record<string, string> }
    >;
  };

  const service = mcp.mcpServers.noesis;
  if (!service) throw new Error('.mcp.json has no noesis server entry');
  // Both are `${VAR:-default}` expansions: installed plugins run
  // the published bin through bunx; a checkout points them at the source.
  expect(service.command).toBe('${NOESIS_SERVICE_COMMAND:-bunx}');
  expect(service.args).toEqual([
    `\${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@${version}}`,
  ]);
  // The service serves the project the plugin runs in, not its own cwd.
  expect(service.env.NOESIS_ROOT).toBe('${CLAUDE_PROJECT_DIR}');

  const serviceManifest = JSON.parse(
    await readFile(join(serviceRoot, 'package.json'), 'utf8'),
  ) as { version: string; bin: Record<string, string> };
  expect(serviceManifest.version).toBe(version);
  expect(serviceManifest.bin).toEqual({ noesis: 'dist/main.js' });
});

test('the service the pin resolves to boots and lists tools', async () => {
  // The workspace sources are what the pinned version is published from.
  const build = spawnSync('bun', ['run', 'build'], {
    cwd: serviceRoot,
    encoding: 'utf8',
  });
  expect(build.status).toBe(0);

  const projectDir = join(workDir, 'project');
  await mkdir(projectDir, { recursive: true });

  const transport = new StdioClientTransport({
    command: 'bun',
    args: [join(serviceRoot, 'dist', 'main.js')],
    cwd: projectDir,
    env: {
      ...process.env,
      NOESIS_ROOT: projectDir,
      NOESIS_OPEN_BROWSER: '0',
    },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'tarball-smoke-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_change',
      'add_design_doc_to_change',
      'add_document_to_change',
      'list_changes',
    ]);
  } finally {
    await client.close();
  }
}, 120_000);
