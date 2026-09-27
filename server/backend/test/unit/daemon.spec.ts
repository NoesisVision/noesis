import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { stat } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import { Daemon } from '#backend/boot/daemon';
import { readServerLock } from '#backend/boot/server-lock';
import { loadServerConfig } from '#backend/platform/config/config';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let daemon: Daemon | undefined;
let idle: number;

beforeEach(async () => {
  t = await testNoesis();
  idle = 0;
});

afterEach(async () => {
  await daemon?.shutdown();
  daemon = undefined;
  await t.cleanup();
});

async function startDaemon(
  overrides: { createChange?: CreateChangeHandler; graceMs?: number } = {},
): Promise<{ daemon: Daemon; base: string }> {
  const started = await Daemon.start({
    config: {
      ...loadServerConfig({ NOESIS_OPEN_BROWSER: '0' }),
      graceMs: overrides.graceMs ?? 60_000,
    },
    noesis: t.noesis,
    version: '9.9.9',
    services: {
      ...t,
      ...(overrides.createChange && { createChange: overrides.createChange }),
    },
    managed: true,
    onIdle: () => void (idle += 1),
  });
  if (!started.started) throw new Error('another daemon holds the lock');
  daemon = started.daemon;
  const port = readServerLock(t.noesis.serverLockPath)?.port;
  return { daemon: started.daemon, base: `http://127.0.0.1:${port}` };
}

/** Opens an attach stream and reads it up to its `attached` event. */
async function attach(base: string) {
  const response = await fetch(`${base}/internal/attach`);
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  let text = '';
  while (!text.includes('event: attached')) {
    const { value } = await reader.read();
    text += new TextDecoder().decode(value);
  }
  return {
    ended: async () => (await reader.read()).done,
    cancel: () => reader.cancel(),
  };
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe('Daemon', () => {
  it('registers with its port and version, and answers health with its instance', async () => {
    const { base } = await startDaemon();
    const lock = readServerLock(t.noesis.serverLockPath);

    const health = await (await fetch(`${base}/internal/health`)).json();

    expect(lock?.version).toBe('9.9.9');
    expect(health).toEqual({
      status: 'ok',
      version: '9.9.9',
      instance: lock?.instance,
    });
  });

  it('counts attach streams, and a stream its session drops as a detach', async () => {
    const { daemon: running, base } = await startDaemon();

    const first = await attach(base);
    await attach(base);
    expect(running.sessions).toBe(2);

    await first.cancel();
    await sleep(50);
    expect(running.sessions).toBe(1);
  });

  it('keeps an idle attach stream open past the server idle timeout', async () => {
    const { daemon: running, base } = await startDaemon();
    await attach(base);

    await sleep(11_000);

    expect(running.sessions).toBe(1);
  }, 15_000);

  it('shuts down after the grace with nobody attached', async () => {
    await startDaemon({ graceMs: 50 });

    await sleep(150);

    expect(idle).toBe(1);
  });

  it('shuts down in order: streams ended, the write in flight answered, the lock released', async () => {
    let admit = () => {};
    const gate = new Promise<void>((resolve) => (admit = resolve));
    const { daemon: running, base } = await startDaemon({
      createChange: {
        handle: async (command) => {
          await gate;
          return t.createChange.handle(command);
        },
      },
    });
    const streams = [await attach(base), await attach(base)];
    const write = fetch(`${base}/ui/changes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'In flight', type: 'chore' }),
    });
    await sleep(50);

    const stopped = running.shutdown();
    daemon = undefined;
    expect(await Promise.all(streams.map((stream) => stream.ended()))).toEqual([
      true,
      true,
    ]);
    admit();

    expect((await write).status).toBe(201);
    await stopped;
    expect(await exists(t.noesis.serverLockPath)).toBe(false);
    expect(
      (await t.changesRepository.list()).map((c) => c.summary().name),
    ).toEqual(['In flight']);
  });
});
