// Black-box e2e for SPA serving: spawns the real server with UI_DIST_PATH
// pointing at a fixture dist, then asserts the SPA is served at /, client
// routes fall back to index.html, and the /ui /api /internal surfaces are
// not swallowed by the fallback. Runs as a subprocess because UI_DIST_PATH
// is read at module-definition time.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const serverRoot = resolve(__dirname, '../..');

const PORT = 3919;
const BASE = `http://localhost:${PORT}`;
const INDEX_MARKER = '<title>noesis-spa-fixture</title>';

let serverProcess: ChildProcess;
let uiDist: string;

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/internal/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

beforeAll(async () => {
  uiDist = await mkdtemp(join(tmpdir(), 'noesis-ui-dist-'));
  await writeFile(
    join(uiDist, 'index.html'),
    `<!doctype html><html><head>${INDEX_MARKER}</head><body></body></html>`,
  );

  serverProcess = spawn('bun', ['run', 'src/main.ts'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      UI_DIST_PATH: uiDist,
      // Ephemeral in-memory DB so the e2e run touches no on-disk data dir.
      NOESIS_DATA_DIR: ':memory:',
    },
    stdio: 'ignore',
  });
  await waitForHealth(15_000);
}, 30_000);

afterAll(async () => {
  serverProcess?.kill();
  if (uiDist) await rm(uiDist, { recursive: true, force: true });
});

describe('SPA serving via UI_DIST_PATH (e2e)', () => {
  it('serves index.html at /', async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(INDEX_MARKER);
  });

  it('falls back to index.html for client-side routes', async () => {
    const res = await fetch(`${BASE}/some/client/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(INDEX_MARKER);
  });

  it('keeps the ui surface working', async () => {
    const res = await fetch(`${BASE}/ui/hello`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('keeps the api surface working', async () => {
    const res = await fetch(`${BASE}/api/hello`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('does not swallow surface 404s into the SPA fallback', async () => {
    const res = await fetch(`${BASE}/api/no-such-endpoint`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(INDEX_MARKER);
  });
});
