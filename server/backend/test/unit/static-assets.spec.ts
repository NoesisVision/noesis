import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { pageBuilt, staticAssets } from '#backend/platform/http/static-assets';

let root: string;
let ui: Hono;

const HASHED = '/assets/index-BwkfbSeq.js';
const BIG = 'globalThis.x = 1;'.repeat(200);
const PAGE = '<title>Noesis</title>';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-ui-'));
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'index.html'), PAGE);
  // The build writes the `.gz` beside every asset worth compressing.
  await writeFile(join(root, 'assets', 'index-BwkfbSeq.js'), BIG);
  await writeFile(
    join(root, 'assets', 'index-BwkfbSeq.js.gz'),
    Bun.gzipSync(BIG),
  );
  await writeFile(join(root, 'assets', 'tiny-AAAAAAAA.js'), 'export {};');
  await writeFile(join(root, 'assets', 'index-v-ydJase.js'), 'export {};');
  ui = staticAssets(root);
});

afterEach(() => rm(root, { recursive: true, force: true }));

const get = (path: string, encoding = 'gzip') =>
  ui.request(path, { headers: { 'accept-encoding': encoding } });

describe('static assets', () => {
  it('serves the compressed sibling of an asset and says what it did', async () => {
    const res = await get(HASHED);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('vary')).toMatch(/accept-encoding/i);
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeLessThan(BIG.length / 2);
  });

  it('sends the bytes themselves when gzip was not offered', async () => {
    const res = await get(HASHED, 'identity');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(BIG);
  });

  it('does not read gzip out of another encoding name', async () => {
    const res = await get(HASHED, 'br, deflate');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(BIG);
  });

  it('serves a file without a compressed sibling as it is', async () => {
    const res = await get('/assets/tiny-AAAAAAAA.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-encoding')).toBeNull();
  });

  it('lets a hashed asset be cached forever and the page never', async () => {
    expect((await get(HASHED)).headers.get('cache-control')).toContain(
      'immutable',
    );
    expect((await get('/index.html')).headers.get('cache-control')).toBe(
      'no-cache',
    );
    expect((await get('/')).headers.get('cache-control')).toBe('no-cache');
  });

  it('answers a file that is not there with 404', async () => {
    expect((await get('/assets/gone-BBBBBBBB.js')).status).toBe(404);
  });

  it('serves nothing from outside the directory it was given', async () => {
    await writeFile(join(root, '..', 'noesis-ui-secret.txt'), 'private');
    for (const path of [
      '/../noesis-ui-secret.txt',
      '/%2e%2e/noesis-ui-secret.txt',
      '/assets/../../noesis-ui-secret.txt',
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('private');
    }
    await rm(join(root, '..', 'noesis-ui-secret.txt'), { force: true });
  });

  it('answers a path the filesystem refuses as absent, not as a crash', async () => {
    for (const path of ['/assets/a%00b.js', `/assets/${'x'.repeat(5000)}.js`]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  it('reads a hash off the name without a pattern that can backtrack', async () => {
    // Immutability is decided per name, and the name comes off the request.
    const immutable = async (path: string) =>
      (await get(path)).headers.get('cache-control')?.includes('immutable');
    expect(await immutable(HASHED)).toBe(true);
    expect(await immutable('/index.html')).toBe(false);
    // A hash may hold a `-` of its own.
    expect(await immutable('/assets/index-v-ydJase.js')).toBe(true);

    const pathological = `/assets/${'-'.repeat(40_000)}x`;
    const started = Bun.nanoseconds();
    await get(pathological);
    expect((Bun.nanoseconds() - started) / 1e6).toBeLessThan(50);
  });

  it('knows whether a page was built at all', async () => {
    expect(await pageBuilt(root)).toBe(true);
    expect(await pageBuilt(join(root, 'nope'))).toBe(false);
  });

  it('answers a missing file with 404, never with the page', async () => {
    const missing = await ui.request('/assets/gone-BBBBBBBB.js');
    expect(missing.status).toBe(404);
    // The page here reaches the browser as HTML where it asked for
    // JavaScript, and the error it reports names the syntax rather than the
    // chunk that is missing.
    expect(await missing.text()).not.toContain(PAGE);
  });

  it('answers the root and a client route with the page', async () => {
    for (const path of ['/', '/changes/test-2/documents/payment-retry']) {
      const page = await ui.request(path);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      expect(await page.text()).toContain(PAGE);
    }
  });

  it('says so plainly when no page has been built', async () => {
    const empty = staticAssets(join(root, 'nope'));
    expect((await empty.request('/')).status).toBe(503);
  });
});
