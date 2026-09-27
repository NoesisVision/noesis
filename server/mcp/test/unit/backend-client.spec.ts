import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  currentProcess,
  type ProcessIdentity,
} from '#backend/boot/server-lock';
import { backendApi } from '#mcp/backend/backend-api';
import { BackendClient } from '#mcp/backend/backend-client';
import { BackendError } from '#mcp/backend/backend-error';
import { exitedProcess } from '../support/processes';

const VERSION = '1.0.0';
const INSTANCE = 'fake-instance';

let dir: string;
let lockPath: string;
const servers: ReturnType<typeof Bun.serve>[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-client-'));
  lockPath = join(dir, 'server.lock');
});

afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop(true);
  await rm(dir, { recursive: true, force: true });
});

interface FakeOptions {
  version?: string;
  instance?: string;
  /** Answers `GET /ui/changes`. */
  changes?: () => Response;
}

/** A backend that answers what the shim asks of it, and counts attaches. */
function fakeBackend(options: FakeOptions = {}) {
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  let attaches = 0;
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request, bun) {
      const { pathname } = new URL(request.url);
      if (pathname === '/internal/health') {
        return Response.json({
          status: 'ok',
          version: options.version ?? VERSION,
          instance: options.instance ?? INSTANCE,
        });
      }
      if (pathname === '/internal/attach') {
        attaches += 1;
        bun.timeout(request, 0);
        const event = `event: attached\ndata: ${JSON.stringify({ url: 'http://localhost:1/', instance: INSTANCE })}\n\n`;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streams.push(controller);
              controller.enqueue(new TextEncoder().encode(event));
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }
      if (pathname === '/ui/changes') {
        return options.changes?.() ?? Response.json({ changes: [] });
      }
      return new Response('not found', { status: 404 });
    },
  });
  servers.push(server);
  return {
    port: server.port ?? 0,
    attaches: () => attaches,
    endStreams: () => {
      for (const stream of streams.splice(0)) stream.close();
    },
  };
}

async function writeLock(
  port: number | undefined,
  owner: ProcessIdentity = currentProcess(),
): Promise<void> {
  await writeFile(
    lockPath,
    JSON.stringify({
      ...owner,
      instance: INSTANCE,
      startedAt: new Date().toISOString(),
      ...(port === undefined ? {} : { port, version: VERSION }),
    }),
  );
}

function client(spawnBackend: () => void = () => {}) {
  let spawns = 0;
  const backend = new BackendClient({
    lockPath,
    version: VERSION,
    spawnBackend: () => {
      spawns += 1;
      spawnBackend();
    },
    connectTimeoutMs: 500,
  });
  return { backend, spawns: () => spawns };
}

describe('BackendClient', () => {
  it('attaches to the backend the lock names, starting none', async () => {
    const fake = fakeBackend();
    await writeLock(fake.port);
    const { backend, spawns } = client();

    const connection = await backend.connection();

    expect(connection.instance).toBe(INSTANCE);
    expect(fake.attaches()).toBe(1);
    expect(spawns()).toBe(0);
    backend.close();
  });

  it('refuses a backend of another version, naming noesis stop', async () => {
    const fake = fakeBackend({ version: '0.9.0' });
    await writeLock(fake.port);
    const { backend } = client();

    const refused = backend.connection();

    await expect(refused).rejects.toBeInstanceOf(BackendError);
    await expect(refused).rejects.toThrow(/0\.9\.0.*noesis stop/s);
  });

  it('does not take an answer from an instance the lock does not name', async () => {
    const fake = fakeBackend({ instance: 'someone-else' });
    await writeLock(fake.port);
    const { backend, spawns } = client();

    await expect(backend.connection()).rejects.toThrow(/does not answer/);
    expect(fake.attaches()).toBe(0);
    expect(spawns()).toBe(0);
  });

  it('starts no second backend beside an owner that runs but does not answer', async () => {
    const closed = fakeBackend();
    await servers.pop()?.stop(true);
    await writeLock(closed.port);
    const { backend, spawns } = client();

    await expect(backend.connection()).rejects.toThrow(
      new RegExp(`pid ${process.pid}.*noesis stop`, 's'),
    );
    expect(spawns()).toBe(0);
  });

  it('starts a backend when the lock names a dead pid, and attaches once it registers', async () => {
    await writeLock(1, await exitedProcess());
    const fake = fakeBackend();
    const { backend, spawns } = client(() => {
      setTimeout(() => void writeLock(fake.port), 100);
    });

    await backend.connection();

    expect(spawns()).toBe(1);
    expect(fake.attaches()).toBe(1);
    backend.close();
  });

  it('shares one connect and one spawn among five concurrent first calls', async () => {
    const fake = fakeBackend();
    const { backend, spawns } = client(() => {
      setTimeout(() => void writeLock(fake.port), 100);
    });
    const api = backendApi(backend);

    const lists = await Promise.all(
      Array.from({ length: 5 }, () => api.changes.$get()),
    );

    expect(lists).toEqual(Array(5).fill({ changes: [] }));
    expect(spawns()).toBe(1);
    expect(fake.attaches()).toBe(1);
    backend.close();
  });

  it('answers a connect that fails, and tries again on the next call', async () => {
    const fake = fakeBackend();
    let register = false;
    const { backend } = client(() => {
      if (register) void writeLock(fake.port);
    });
    const api = backendApi(backend);

    await expect(api.changes.$get()).rejects.toThrow(
      /could not be started or reached/,
    );
    register = true;

    expect(await api.changes.$get()).toEqual({ changes: [] });
    backend.close();
  });

  it('reconnects before the next call once the attach stream has ended', async () => {
    const fake = fakeBackend();
    await writeLock(fake.port);
    const { backend } = client();
    const api = backendApi(backend);
    await api.changes.$get();

    fake.endStreams();
    await sleep(100);
    await api.changes.$get();

    expect(fake.attaches()).toBe(2);
    backend.close();
  });

  it('answers a request that fails in flight as an unknown outcome', async () => {
    const fake = fakeBackend({
      changes: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"chan'));
              controller.error(new Error('connection reset'));
            },
          }),
        ),
    });
    await writeLock(fake.port);
    const { backend } = client();

    await expect(backendApi(backend).changes.$get()).rejects.toThrow(
      /whether it took effect is unknown/,
    );
    await sleep(100);
    backend.close();
  });
});
