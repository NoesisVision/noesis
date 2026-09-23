// Runs the real service from source. The page is vite's build output, which
// `test:e2e` produces before this runs — the service serves it from disk and
// no longer carries it.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  listeningUrl,
  serviceEnv,
  startServing,
} from '../support/service-process';

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
  startServing(serverProcess);
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

  it('ships colours the browser can resolve', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const style = /<link[^>]+href="([^"]+\.css)"/.exec(html)?.[1] ?? '';
    const css = await (await fetch(`${BASE}${style}`)).text();

    // Below the `light-dark()` baseline, LightningCSS rewrites it to a pair
    // of toggle variables it then never defines, and every colour in that
    // declaration is dropped. Native `light-dark()` also follows Mantine's
    // scheme attribute, where the polyfill would follow the OS.
    expect(css).not.toContain('--lightningcss-');
    expect(css).toContain('light-dark(');
  });

  it('ships the pause that keeps a fast read from flashing a spinner', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const style = /<link[^>]+href="([^"]+\.css)"/.exec(html)?.[1] ?? '';
    const css = await (await fetch(`${BASE}${style}`)).text();

    // The loading panel is invisible until the wait is worth saying, which is
    // the animation's delay plus `both` holding its first frame through it.
    // Tests cannot see a CSS module class, so the shipped rule is the check.
    expect(css).toMatch(/animation:[^;}]*\.4s both/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\._delayed/);
  });

  it('compresses what it serves, and says so', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1] ?? '';

    const plain = await fetch(`${BASE}${script}`, {
      headers: { 'accept-encoding': 'identity' },
    });
    expect(plain.headers.get('content-encoding')).toBeNull();
    const raw = (await plain.arrayBuffer()).byteLength;

    const zipped = await fetch(`${BASE}${script}`, {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(zipped.headers.get('content-encoding')).toBe('gzip');
    expect(zipped.headers.get('vary')).toContain('accept-encoding');
    // Bun decodes the body, so the saving is read off the header instead.
    expect(Number(zipped.headers.get('content-length'))).toBeLessThan(raw / 2);
  });

  it('lets a hashed asset be cached forever and the page never', async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    const script = /<script[^>]+src="([^"]+)"/.exec(html)?.[1] ?? '';
    const asset = await fetch(`${BASE}${script}`);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    const page = await fetch(`${BASE}/`);
    expect(page.headers.get('cache-control')).toBe('no-cache');
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

  it('does not swallow a missing asset into the SPA fallback', async () => {
    const res = await fetch(`${BASE}/assets/does-not-exist-AAAAAAAA.js`);
    expect(res.status).toBe(404);
    // The page here arrives where the browser asked for JavaScript, and the
    // error it reports names the syntax rather than the missing chunk.
    expect(await res.text()).not.toContain(INDEX_MARKER);
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
