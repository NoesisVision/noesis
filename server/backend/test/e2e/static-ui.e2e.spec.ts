// Runs the real service from source: bun bundles the imported index.html on
// the fly.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { listeningUrl, serviceEnv } from '../support/service-process';

const serviceRoot = resolve(__dirname, '../..');

const INDEX_MARKER = '<title>Noesis</title>';

let serverProcess: ChildProcess;
let repoRoot: string;
let BASE: string;

beforeAll(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'noesis-root-'));

  serverProcess = spawn('bun', ['run', 'src/main.ts'], {
    cwd: serviceRoot,
    env: serviceEnv(repoRoot),
    // stdin stays open: the service treats a closed MCP stream as the end of
    // the session and exits.
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  BASE = await listeningUrl(serverProcess, 15_000);
}, 30_000);

afterAll(async () => {
  serverProcess?.kill();
  if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
});

describe('SPA serving (e2e)', () => {
  it('serves index.html at /', async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(INDEX_MARKER);
  });

  it('serves the same page for client-side routes', async () => {
    const res = await fetch(`${BASE}/some/client/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(INDEX_MARKER);
  });

  it('links its bundled script and stylesheet by absolute paths that resolve', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
    const style = /<link[^>]+href="([^"]+\.css)"/.exec(html)?.[1];
    expect(script?.startsWith('/')).toBe(true);
    expect(style?.startsWith('/')).toBe(true);
    const js = await fetch(`${BASE}${script}`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    const css = await fetch(`${BASE}${style}`);
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toContain('text/css');
  });

  it('keeps the ui surface working', async () => {
    const res = await fetch(`${BASE}/ui/changes`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changes: [] });
  });

  it('keeps the internal surface working', async () => {
    const res = await fetch(`${BASE}/internal/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('does not swallow surface 404s into the SPA fallback', async () => {
    const res = await fetch(`${BASE}/ui/no-such-endpoint`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(INDEX_MARKER);
  });

  it('exits when the MCP stream closes — the UI lives as long as the session', async () => {
    const exited = new Promise<number | null>((r) =>
      serverProcess.on('exit', (code) => r(code)),
    );
    serverProcess.stdin?.end();
    expect(await exited).toBe(0);
  }, 10_000);
});
