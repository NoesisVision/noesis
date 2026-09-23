import { join, normalize, resolve, sep } from 'node:path';

/** What is worth compressing: text, and nothing already compressed. */
const COMPRESSIBLE =
  /^(?:text\/|application\/(?:javascript|json|xml|wasm)|image\/svg)/;

/** Below this, the header costs more than the compression saves. */
const COMPRESS_FROM_BYTES = 1024;

interface Asset {
  bytes: Uint8Array;
  gzipped: Uint8Array | null;
  type: string;
  /** A built asset carries its content hash in its name and never changes. */
  immutable: boolean;
}

/**
 * The built SPA on disk. Its files are read and compressed once and then held,
 * because the whole directory is a few megabytes, one process serves one
 * session, and a reader opening a document with a diagram in it pulls a
 * handful of chunks at once.
 */
export class StaticAssets {
  /** Named by the build, so a hashed asset name means exactly one body. */
  private readonly cache = new Map<string, Asset>();
  private readonly root: string;
  private readonly indexPath: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.indexPath = join(this.root, 'index.html');
  }

  /**
   * The built file, the page for a client route, or a 404 — never the page
   * where a file was asked for. A missing chunk answered with `index.html`
   * reaches the browser as HTML it tries to parse as JavaScript, and the
   * error names the wrong thing entirely.
   */
  async respond(request: Request): Promise<Response> {
    const file = await this.serve(request);
    if (file !== null) return file;

    if (namesAFile(new URL(request.url).pathname)) {
      return new Response('Not found', { status: 404 });
    }
    return (
      (await this.serveIndex(request)) ??
      new Response('The page has not been built.', { status: 503 })
    );
  }

  /** `null` when the request names a file that is not there. */
  async serve(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    const asset = await this.read(path);
    if (asset === null) return null;
    return this.asResponse(asset, request.headers.get('accept-encoding') ?? '');
  }

  /** The page itself, for a client-side route that names no file. */
  async serveIndex(request: Request): Promise<Response | null> {
    const asset = await this.load(this.indexPath, false);
    if (asset === null) return null;
    return this.asResponse(asset, request.headers.get('accept-encoding') ?? '');
  }

  async exists(): Promise<boolean> {
    return Bun.file(this.indexPath).exists();
  }

  private async read(pathname: string): Promise<Asset | null> {
    const file = this.locate(pathname);
    if (file === null) return null;
    return this.load(file, isHashed(pathname));
  }

  private async load(file: string, immutable: boolean): Promise<Asset | null> {
    const held = this.cache.get(file);
    if (held !== undefined) return held;

    const bytes = await read(file);
    if (bytes === null) return null;

    const handle = Bun.file(file);
    const type = handle.type || 'application/octet-stream';
    const asset: Asset = {
      bytes,
      gzipped: worthGzipping(type, bytes) ? Bun.gzipSync(bytes) : null,
      type,
      immutable,
    };
    this.cache.set(file, asset);
    return asset;
  }

  /** `null` for a path that climbs out of the directory or names it. */
  private locate(pathname: string): string | null {
    const decoded = safeDecode(pathname);
    if (decoded === null || decoded.endsWith('/')) return null;
    const file = resolve(join(this.root, normalize(decoded)));
    return file.startsWith(this.root + sep) ? file : null;
  }

  private asResponse(asset: Asset, acceptEncoding: string): Response {
    const headers = new Headers({
      'content-type': asset.type,
      'cache-control': asset.immutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      vary: 'accept-encoding',
    });
    if (asset.gzipped !== null && acceptsGzip(acceptEncoding)) {
      headers.set('content-encoding', 'gzip');
      return new Response(asset.gzipped, { headers });
    }
    return new Response(asset.bytes, { headers });
  }
}

/**
 * A last segment with a suffix in it. No client route has one: a change slug,
 * a document id and a design document's uuid are all free of `.`.
 */
function namesAFile(pathname: string): boolean {
  const last = pathname.split('/').at(-1) ?? '';
  return last.includes('.');
}

function worthGzipping(type: string, bytes: Uint8Array): boolean {
  return COMPRESSIBLE.test(type) && bytes.byteLength >= COMPRESS_FROM_BYTES;
}

function acceptsGzip(header: string): boolean {
  return header
    .split(',')
    .some((part) => part.trim().split(';')[0]?.trim() === 'gzip');
}

/**
 * The bytes, or `null` for anything this process cannot read as a file — it is
 * absent as far as a reader is concerned. A path off the request line need not
 * be one the filesystem will even look at: too long a name is an error, not a
 * miss, and it would otherwise leave the route with nothing to answer.
 */
async function read(file: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const handle = Bun.file(file);
    return (await handle.exists())
      ? new Uint8Array(await handle.arrayBuffer())
      : null;
  } catch {
    return null;
  }
}

/** As long as the shortest hash vite emits. */
const HASH_MIN_LENGTH = 8;
/** Anchored on both ends around one class, so it cannot backtrack. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Vite names a built asset `<name>-<hash>.<ext>`; `index.html` is not one.
 * Found by index rather than matched: the path comes off the request line,
 * and a pattern whose leading `-` is also inside its own class backtracks.
 */
function isHashed(pathname: string): boolean {
  const name = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const dash = dot <= 0 ? -1 : name.lastIndexOf('-', dot);
  if (dash <= 0) return false;
  const hash = name.slice(dash + 1, dot);
  return hash.length >= HASH_MIN_LENGTH && BASE64URL.test(hash);
}

function safeDecode(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes('\0') ? null : decoded;
  } catch {
    return null;
  }
}
