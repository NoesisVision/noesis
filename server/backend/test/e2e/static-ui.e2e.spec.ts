// Black-box e2e for SPA serving: spawns the real service with UI_DIST_PATH
// pointing at a fixture dist, then asserts the SPA is served at /, client
// routes fall back to index.html, and the /ui and /internal surfaces are not
// swallowed by the fallback. The port is ephemeral, so the URL is read from
// the service's own log line on stderr — the way a person finds it too.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const serviceRoot = resolve(__dirname, '../..');

const INDEX_MARKER = '<title>noesis-spa-fixture</title>';

let serverProcess: ChildProcess;
let uiDist: string;
let repoRoot: string;
let BASE: string;

function listeningUrl(child: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolveUrl, reject) => {
    let log = '';
    const timer = setTimeout(
      () =>
        reject(new Error(`No listening line within ${timeoutMs}ms:\n${log}`)),
      timeoutMs,
    );
    child.stderr?.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      const match = /\[server\] listening on (http:\/\/\S+)/.exec(log);
      if (match?.[1]) {
        clearTimeout(timer);
        resolveUrl(match[1].replace(/\/$/, ''));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(
        new Error(`Service exited with ${code} before listening:\n${log}`),
      );
    });
  });
}

beforeAll(async () => {
  uiDist = await mkdtemp(join(tmpdir(), 'noesis-ui-dist-'));
  await writeFile(
    join(uiDist, 'index.html'),
    `<!doctype html><html><head>${INDEX_MARKER}</head><body></body></html>`,
  );
  repoRoot = await mkdtemp(join(tmpdir(), 'noesis-root-'));

  serverProcess = spawn('bun', ['run', 'src/main.ts'], {
    cwd: serviceRoot,
    env: {
      ...process.env,
      UI_DIST_PATH: uiDist,
      // A throwaway repository root so the run writes no `.noesis/` here,
      // and no browser popping up in a test run.
      NOESIS_ROOT: repoRoot,
      NOESIS_OPEN_BROWSER: '0',
    },
    // stdin stays open: the service treats a closed MCP stream as the end of
    // the session and exits.
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  BASE = await listeningUrl(serverProcess, 15_000);
}, 30_000);

afterAll(async () => {
  serverProcess?.kill();
  if (uiDist) await rm(uiDist, { recursive: true, force: true });
  if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
});

describe('SPA serving (e2e)', () => {
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
