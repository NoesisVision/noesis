import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { ownerRuns, readServerLock } from '#backend/boot/server-lock';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { BackendError } from './backend-error';

const log = serverLogger('backend');

const CONNECT_TIMEOUT_MS = 10_000;
const POLL_MS = 100;
const HEALTH_TIMEOUT_MS = 1_000;

const Health = z.object({
  status: z.literal('ok'),
  version: z.string(),
  instance: z.string(),
});

const Attached = z.object({ url: z.string(), instance: z.string() });

/** What of a response body's reader the stream is read with. */
interface ChunkReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}

/** One attachment to the backend, good while its stream is open. */
export interface Connection {
  /** Where its routes answer, e.g. `http://127.0.0.1:4321`. */
  origin: string;
  /** The page, as the backend announces it. */
  url: string;
  instance: string;
}

export interface BackendClientOptions {
  lockPath: string;
  version: string;
  /** Starts a managed backend for the repository, detached. */
  spawnBackend: () => void;
  connectTimeoutMs?: number;
}

/**
 * The session's way to the repository's backend. It holds one promise of a
 * connection, so concurrent calls share one start and one reconnect; a
 * connect that fails clears it, and the next call tries again. It never
 * starts a backend beside one that holds the lock.
 */
export class BackendClient {
  private readonly options: BackendClientOptions;
  private current: Promise<Connection> | undefined;
  private live: { connection: Connection; stream: AbortController } | undefined;

  constructor(options: BackendClientOptions) {
    this.options = options;
  }

  connection(): Promise<Connection> {
    this.current ??= this.connect().catch((error: unknown) => {
      this.current = undefined;
      throw error;
    });
    return this.current;
  }

  /** The connection is over — its stream ended, or the backend is going; the next call reconnects. */
  forget(connection: Connection): void {
    if (this.live?.connection !== connection) return;
    this.live.stream.abort();
    this.live = undefined;
    this.current = undefined;
  }

  /** Closes the attach stream, so the backend sees this session leave at once. */
  close(): void {
    if (this.live !== undefined) this.forget(this.live.connection);
  }

  private async connect(): Promise<Connection> {
    const deadline =
      Date.now() + (this.options.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
    let spawned = false;
    for (;;) {
      const lock = readServerLock(this.options.lockPath);
      const running = lock !== null && ownerRuns(lock);
      if (running && lock.port !== undefined) {
        const health = await askHealth(lock.port);
        if (health?.instance === lock.instance) {
          if (health.version !== this.options.version) {
            throw BackendError.otherVersion(
              health.version,
              this.options.version,
            );
          }
          const connection = await this.attach(lock.port);
          if (connection !== null) return connection;
        }
      }
      if (!running && !spawned) {
        log.info('no service runs for this repository — starting one');
        this.options.spawnBackend();
        spawned = true;
      }
      if (Date.now() >= deadline) {
        throw running
          ? BackendError.notAnswering(lock.pid)
          : BackendError.unreachable(
              'no service registered in .noesis/server.lock in time.',
            );
      }
      await sleep(POLL_MS);
    }
  }

  /** `null` when the backend would not take the session: it is shutting down. */
  private async attach(port: number): Promise<Connection | null> {
    const stream = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/internal/attach`, {
      signal: stream.signal,
    }).catch(() => null);
    if (response?.status !== 200 || response.body === null) {
      stream.abort();
      return null;
    }
    const reader = response.body.getReader();
    const attached = await readAttached(reader).catch(() => null);
    if (attached === null) {
      stream.abort();
      return null;
    }
    const connection: Connection = {
      origin: `http://127.0.0.1:${port}`,
      url: attached.url,
      instance: attached.instance,
    };
    this.live = { connection, stream };
    log.info('attached to {url}', { url: attached.url });
    void this.watchStream(reader, connection);
    return connection;
  }

  private async watchStream(
    reader: ChunkReader,
    connection: Connection,
  ): Promise<void> {
    try {
      while (!(await reader.read()).done);
    } catch {
      // Aborted or reset: either way the stream is over.
    }
    if (this.live?.connection !== connection) return;
    log.info('the service ended the attach stream; the next call reconnects');
    this.forget(connection);
  }
}

async function askHealth(port: number): Promise<z.infer<typeof Health> | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/internal/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const parsed = Health.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Reads server-sent events up to the one the backend opens the stream with. */
async function readAttached(
  reader: ChunkReader,
): Promise<z.infer<typeof Attached> | null> {
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return null;
    text += decoder.decode(value, { stream: true });
    for (const event of text.split('\n\n').slice(0, -1)) {
      const lines = event.split('\n');
      if (!lines.includes('event: attached')) continue;
      const data = lines.find((line) => line.startsWith('data: '));
      return Attached.parse(JSON.parse(data?.slice('data: '.length) ?? ''));
    }
  }
}
