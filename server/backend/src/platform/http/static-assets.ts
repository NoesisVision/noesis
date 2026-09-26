import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type Context, Hono } from 'hono';
import { serveStatic } from 'hono/serve-static';

const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The built SPA on disk, read on each request. A built file, or its `.gz`
 * beside it when the browser accepts gzip (the build writes one for every
 * text asset worth compressing); the page for a client route; or a 404 —
 * never the page where a file was asked for. A missing chunk answered with
 * `index.html` reaches the browser as HTML it tries to parse as JavaScript,
 * and the error names the wrong thing entirely.
 */
export function staticAssets(root: string) {
  const served = {
    root,
    precompressed: true,
    onFound: cacheFor,
    getContent,
    isDir,
  };
  const file = serveStatic(served);
  const page = serveStatic({ ...served, path: 'index.html' });
  return new Hono()
    .use(file)
    .use(async (c, next) => {
      if (namesAFile(c.req.path)) return c.text('Not found', 404);
      await next();
    })
    .use(page)
    .all('*', (c) => c.text('The page has not been built.', 503));
}

export function pageBuilt(root: string): Promise<boolean> {
  return Bun.file(join(root, 'index.html')).exists();
}

/**
 * The bytes, or `null` for anything this process cannot read as a file — it is
 * absent as far as a reader is concerned. Hono's own Bun reader lets the
 * filesystem's refusal through: a path off the request line need not be one
 * it will even look at (a null byte, too long a name), and that is a 500
 * where a 404 is meant.
 */
async function getContent(path: string): Promise<ArrayBuffer | null> {
  try {
    const file = Bun.file(path);
    return (await file.exists()) ? await file.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** A built asset carries its content hash in its name and never changes. */
function cacheFor(path: string, c: Context): void {
  c.header('cache-control', isHashed(path) ? IMMUTABLE : 'no-cache');
}

/**
 * A last segment with a suffix in it. No client route has one: change,
 * document and design document ids are all free of `.`.
 */
function namesAFile(pathname: string): boolean {
  const last = pathname.split('/').at(-1) ?? '';
  return last.includes('.');
}

/** As long as the hash vite emits. */
const HASH_LENGTH = 8;
/** Anchored on both ends around one class, so it cannot backtrack. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Vite names a built asset `<name>-<hash>.<ext>`; `index.html` is not one.
 * The hash is base64url, so it may hold a `-` itself (`index-v-ydJase.js`):
 * it is the fixed-length run before the extension, not whatever follows the
 * last `-`. Found by index rather than matched: the path comes off the
 * request line, and a pattern whose leading `-` is also inside its own class
 * backtracks.
 */
function isHashed(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const start = dot - HASH_LENGTH;
  if (start < 2 || name[start - 1] !== '-') return false;
  return BASE64URL.test(name.slice(start, dot));
}
