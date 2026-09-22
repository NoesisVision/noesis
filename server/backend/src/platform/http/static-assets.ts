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

  /** `null` when the request names a file that is not there. */
  async serve(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    const asset = await this.read(path);
    if (asset === null) return null;
    return this.respond(asset, request.headers.get('accept-encoding') ?? '');
  }

  /** The page itself, for a client-side route that names no file. */
  async serveIndex(request: Request): Promise<Response | null> {
    const asset = await this.load(this.indexPath, false);
    if (asset === null) return null;
    return this.respond(asset, request.headers.get('accept-encoding') ?? '');
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

    const handle = Bun.file(file);
    if (!(await handle.exists())) return null;

    const bytes = new Uint8Array(await handle.arrayBuffer());
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

  private respond(asset: Asset, acceptEncoding: string): Response {
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

function worthGzipping(type: string, bytes: Uint8Array): boolean {
  return COMPRESSIBLE.test(type) && bytes.byteLength >= COMPRESS_FROM_BYTES;
}

function acceptsGzip(header: string): boolean {
  return header
    .split(',')
    .some((part) => part.trim().split(';')[0]?.trim() === 'gzip');
}

/** Vite names a built asset `<name>-<hash>.<ext>`; `index.html` is not one. */
function isHashed(pathname: string): boolean {
  return /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(pathname);
}

function safeDecode(pathname: string): string | null {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded.includes('\0') ? null : decoded;
  } catch {
    return null;
  }
}
