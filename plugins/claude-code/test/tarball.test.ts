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
    'contracts/new-change.schema.json',
    'skills/add-document-to-change/SKILL.md',
    'skills/add-document-to-change/scripts/write-working-file.ts',
    'skills/add-change/SKILL.md',
    'skills/create-design-doc/SKILL.md',
    'skills/create-design-doc/references/modelling.md',
    'skills/create-design-doc/references/alternative-brief.md',
    'skills/implement-java-spring/SKILL.md',
    'skills/implement-java-spring/references/mapping.md',
    'skills/implement-java-spring/references/building-blocks.md',
    'skills/implement-java-spring/references/testing.md',
    'skills/setup-java-scanner/SKILL.md',
    'skills/setup-dotnet-scanner/SKILL.md',
    'hooks/hooks.json',
    'hooks/check-scanner-settings.ts',
    'contracts/system-model.schema.json',
    'server/main.js',
    'server/ui/index.html',
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

test('ships the built service: one bundle and the page beside it', async () => {
  const serverDir = join(packageDir, 'server');
  const shipped = (
    await readdir(serverDir, { recursive: true, withFileTypes: true })
  )
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath.slice(serverDir.length + 1), e.name))
    .sort();
  // Only main.js and ui/ are copied, so a stale chunk in the service's
  // dist/ can't ship.
  expect(shipped.filter((f) => !f.startsWith('ui/'))).toEqual(['main.js']);
  // The page's assets are vite's own files. Their hashes are base64url, so
  // `-` is in them.
  expect(shipped.some((f) => /^ui\/assets\/index-[\w-]+\.js$/.test(f))).toBe(
    true,
  );
  expect(shipped.some((f) => /^ui\/assets\/index-[\w-]+\.css$/.test(f))).toBe(
    true,
  );

  const bin = await readFile(join(serverDir, 'main.js'), 'utf8');
  expect(bin.startsWith('#!/usr/bin/env bun\n')).toBe(true);

  // The service has no runtime dependencies: Claude Code installs none for
  // an npm-source plugin without a lockfile, so the bundle must stand alone.
  const service = JSON.parse(
    await readFile(join(serviceRoot, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  expect(service.dependencies).toBeUndefined();
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

test('.mcp.json launches the bundled service', async () => {
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
  // Installed plugins run the bundle from their own directory; a checkout
  // points NOESIS_SERVICE_ENTRY at the source.
  expect(service.command).toBe('bun');
  expect(service.args).toEqual([
    '${NOESIS_SERVICE_ENTRY:-${CLAUDE_PLUGIN_ROOT}/server/main.js}',
  ]);
  // The service serves the project the plugin runs in, not its own cwd.
  expect(service.env.NOESIS_ROOT).toBe('${CLAUDE_PROJECT_DIR}');
});

test('the service reports the plugin version', async () => {
  const plugin = JSON.parse(
    await readFile(join(pluginRoot, 'package.json'), 'utf8'),
  ) as { version: string };
  const service = JSON.parse(
    await readFile(join(serviceRoot, 'package.json'), 'utf8'),
  ) as { version: string };
  expect(service.version).toBe(plugin.version);
});

test('the shipped service boots from the tarball, lists tools and serves the page', async () => {
  const projectDir = join(workDir, 'project');
  await mkdir(projectDir, { recursive: true });

  // Launched from another directory, as Claude Code does: the extracted
  // tarball holds everything the service needs.
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [join(packageDir, 'server', 'main.js')],
    cwd: projectDir,
    env: {
      ...process.env,
      NOESIS_ROOT: projectDir,
      NOESIS_OPEN_BROWSER: '0',
    },
    stderr: 'pipe',
  });
  let log = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    log += chunk.toString();
  });
  const client = new Client({ name: 'tarball-smoke-test', version: '0.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_change',
      'create_design_doc_in_change',
      'create_document_in_change',
      'delete_change',
      'get_design_doc_in_change',
      'get_document_in_change',
      'get_newest_system_model',
      'list_changes',
      'list_design_docs_in_change',
      'list_documents_in_change',
      'scan_system_model',
      'update_change',
      'update_design_doc_in_change',
      'update_document_in_change',
    ]);

    const base = await listeningUrl(() => log, 15_000);
    const page = await fetch(`${base}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<title>Noesis</title>');
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    const asset = await fetch(`${base}${script}`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
  } finally {
    await client.close();
  }
}, 120_000);

// The port is ephemeral, so the URL is read from the service's stderr
// announcement: a JSON line from the built bin, the URL in escaped quotes.
async function listeningUrl(
  stderr: () => string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = /listening on \\?"?(http:\/\/[^\s"\\]+)/.exec(stderr());
    if (match?.[1]) return match[1].replace(/\/$/, '');
    await Bun.sleep(50);
  }
  throw new Error(`No listening line within ${timeoutMs}ms:\n${stderr()}`);
}
