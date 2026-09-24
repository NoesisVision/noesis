import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StaticAssets } from '#backend/platform/http/static-assets';

let root: string;
let ui: StaticAssets;

const HASHED = '/assets/index-BwkfbSeq.js';
const BIG = 'globalThis.x = 1;'.repeat(200);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-ui-'));
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<title>Noesis</title>');
  await writeFile(join(root, 'assets', 'index-BwkfbSeq.js'), BIG);
  await writeFile(join(root, 'assets', 'tiny-AAAAAAAA.js'), 'export {};');
  await writeFile(join(root, 'assets', 'index-v-ydJase.js'), 'export {};');
  ui = new StaticAssets(root);
});

afterEach(() => rm(root, { recursive: true, force: true }));

const get = (path: string, encoding = 'gzip') =>
  ui.serve(
    new Request(`http://localhost${path}`, {
      headers: { 'accept-encoding': encoding },
    }),
  );

describe('static assets', () => {
  it('compresses a text asset and says what it did', async () => {
    const res = await get(HASHED);
    expect(res?.status).toBe(200);
    expect(res?.headers.get('content-encoding')).toBe('gzip');
    expect(res?.headers.get('vary')).toBe('accept-encoding');
    const body = await res?.arrayBuffer();
    expect(body?.byteLength).toBeLessThan(BIG.length / 2);
  });

  it('sends the bytes themselves when gzip was not offered', async () => {
    const res = await get(HASHED, 'identity');
    expect(res?.headers.get('content-encoding')).toBeNull();
    expect(await res?.text()).toBe(BIG);
  });

  it('does not read `gzipped` out of another encoding name', async () => {
    const res = await get(HASHED, 'br, deflate');
    expect(res?.headers.get('content-encoding')).toBeNull();
  });

  it('leaves a file too small to be worth compressing alone', async () => {
    const res = await get('/assets/tiny-AAAAAAAA.js');
    expect(res?.headers.get('content-encoding')).toBeNull();
  });

  it('lets a hashed asset be cached forever and the page never', async () => {
    expect((await get(HASHED))?.headers.get('cache-control')).toContain(
      'immutable',
    );
    expect((await get('/index.html'))?.headers.get('cache-control')).toBe(
      'no-cache',
    );
  });

  it('reports a file that is not there, so the page can answer instead', async () => {
    expect(await get('/assets/gone-BBBBBBBB.js')).toBeNull();
    const page = await ui.serveIndex(new Request('http://localhost/changes/x'));
    expect(await page?.text()).toContain('<title>Noesis</title>');
  });

  it('serves nothing from outside the directory it was given', async () => {
    await writeFile(join(root, '..', 'noesis-ui-secret.txt'), 'private');
    expect(await get('/../noesis-ui-secret.txt')).toBeNull();
    expect(await get('/%2e%2e/noesis-ui-secret.txt')).toBeNull();
    expect(await get('/assets/../../noesis-ui-secret.txt')).toBeNull();
    await rm(join(root, '..', 'noesis-ui-secret.txt'), { force: true });
  });

  it('reads a hash off the name without a pattern that can backtrack', async () => {
    // Immutability is decided per name, and the name comes off the request.
    const immutable = async (path: string) =>
      (await get(path))?.headers.get('cache-control')?.includes('immutable');
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
    expect(await ui.exists()).toBe(true);
    expect(await new StaticAssets(join(root, 'nope')).exists()).toBe(false);
  });

  it('answers a missing file with 404, never with the page', async () => {
    const missing = await ui.respond(
      new Request('http://localhost/assets/gone-BBBBBBBB.js'),
    );
    expect(missing.status).toBe(404);
    // The page here reaches the browser as HTML where it asked for
    // JavaScript, and the error it reports names the syntax rather than the
    // chunk that is missing.
    expect(await missing.text()).not.toContain('<title>Noesis</title>');
  });

  it('answers a client route with the page', async () => {
    const page = await ui.respond(
      new Request('http://localhost/changes/test-2/documents/payment-retry'),
    );
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>Noesis</title>');
  });

  it('says so plainly when no page has been built', async () => {
    const empty = new StaticAssets(join(root, 'nope'));
    expect((await empty.respond(new Request('http://localhost/'))).status).toBe(
      503,
    );
  });
});
