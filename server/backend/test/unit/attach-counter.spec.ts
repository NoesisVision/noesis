import { describe, expect, it } from 'bun:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { AttachCounter } from '#backend/boot/attach-counter';

const GRACE_MS = 40;

/** A stream its session can abort, as Hono's stream would be. */
function stream() {
  const listeners: (() => void)[] = [];
  return {
    onAbort: (listener: () => void) => void listeners.push(listener),
    abort: () => {
      for (const listener of listeners) listener();
    },
  };
}

function counter() {
  let idle = 0;
  const attachments = new AttachCounter({
    graceMs: GRACE_MS,
    onIdle: () => void (idle += 1),
  });
  return { attachments, idleCalls: () => idle };
}

describe('AttachCounter', () => {
  it('shuts down after the grace from boot when nobody attaches', async () => {
    const { attachments, idleCalls } = counter();
    attachments.startGrace();

    await sleep(GRACE_MS * 2);

    expect(idleCalls()).toBe(1);
  });

  it('cancels the grace when a session attaches late', async () => {
    const { attachments, idleCalls } = counter();
    attachments.startGrace();
    await sleep(GRACE_MS / 2);

    void attachments.hold(stream());
    await sleep(GRACE_MS * 2);

    expect(idleCalls()).toBe(0);
    expect(attachments.count).toBe(1);
  });

  it('counts an aborted stream as a detach, and shuts down after the last one', async () => {
    const { attachments, idleCalls } = counter();
    const first = stream();
    const second = stream();
    const held = attachments.hold(first);
    void attachments.hold(second);

    first.abort();
    await held;
    expect(attachments.count).toBe(1);
    await sleep(GRACE_MS * 2);
    expect(idleCalls()).toBe(0);

    second.abort();
    await sleep(GRACE_MS * 2);
    expect(attachments.count).toBe(0);
    expect(idleCalls()).toBe(1);
  });

  it('ends every stream on closeAll, and arms no grace after', async () => {
    const { attachments, idleCalls } = counter();
    const held = [attachments.hold(stream()), attachments.hold(stream())];

    attachments.closeAll();
    await Promise.all(held);
    await sleep(GRACE_MS * 2);

    expect(attachments.count).toBe(0);
    expect(idleCalls()).toBe(0);
  });

  it('never shuts down a daemon started by hand', async () => {
    let idle = 0;
    const attachments = new AttachCounter({
      graceMs: null,
      onIdle: () => void (idle += 1),
    });
    attachments.startGrace();
    const one = stream();
    void attachments.hold(one);
    one.abort();

    await sleep(GRACE_MS * 2);

    expect(idle).toBe(0);
  });
});
