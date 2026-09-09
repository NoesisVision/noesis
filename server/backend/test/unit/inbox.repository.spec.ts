import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { DatabaseService } from '../../src/database/database.service.js';
import {
  InboxRepository,
  type InboxSignalInput,
} from '../../src/inbox/inbox.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The inbox lifecycle at the repository layer: dedup folding, the conditional
// state transitions, and the lifecycle sweeps (expiry, wake).

let db: DatabaseService;
let inbox: InboxRepository;

beforeAll(async () => {
  db = await sharedTestDatabase();
  inbox = new InboxRepository(db);
});

afterEach(resetGraph);

function alert(overrides: Partial<InboxSignalInput> = {}): InboxSignalInput {
  return {
    kind: 'alert',
    title: 'CPU saturation on billing-service',
    origin: 'Grafana',
    body: 'CPU > 95% for 10m',
    ...overrides,
  };
}

const inFuture = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();
const inPast = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

describe('InboxRepository — ingest and dedup', () => {
  it('creates a new open item with a single occurrence', async () => {
    const item = await inbox.ingest(alert({ dedupKey: 'cpu-billing' }));
    expect(item.state).toBe('open');
    expect(item.count).toBe(1);
    expect(item.occurrences).toHaveLength(1);
    expect(item.dedup_key).toBe('cpu-billing');
  });

  it('folds a repeat with the same dedup key into the existing item', async () => {
    const first = await inbox.ingest(alert({ dedupKey: 'cpu-billing' }));
    const second = await inbox.ingest(alert({ dedupKey: 'cpu-billing' }));
    expect(second.id).toBe(first.id);
    expect(second.count).toBe(2);
    expect(second.occurrences).toHaveLength(2);
    expect(await inbox.list()).toHaveLength(1);
  });

  it('treats a signal without a dedup key as a new item every time', async () => {
    await inbox.ingest(alert());
    await inbox.ingest(alert());
    expect(await inbox.list()).toHaveLength(2);
  });

  it('a repeat after dismissal starts a new item, not a reopen', async () => {
    const first = await inbox.ingest(alert({ dedupKey: 'cpu' }));
    await inbox.dismiss(first.id, 'known issue');
    const second = await inbox.ingest(alert({ dedupKey: 'cpu' }));
    expect(second.id).not.toBe(first.id);
    expect(second.count).toBe(1);
  });

  it('caps the stored occurrence history while count keeps counting', async () => {
    let last = await inbox.ingest(alert({ dedupKey: 'noisy' }));
    for (let i = 1; i < 12; i++) {
      last = await inbox.ingest(alert({ dedupKey: 'noisy' }));
    }
    expect(last.count).toBe(12);
    expect(last.occurrences).toHaveLength(10);
  });
});

describe('InboxRepository — state transitions', () => {
  it('dismiss records the outcome and refuses a second dismissal', async () => {
    const item = await inbox.ingest(alert());
    const dismissed = await inbox.dismiss(
      item.id,
      'duplicate of the pager alert',
    );
    expect(dismissed?.state).toBe('dismissed');
    expect(dismissed?.outcome_reason).toBe('duplicate of the pager alert');
    expect(dismissed?.outcome_at).not.toBeNull();
    expect(await inbox.dismiss(item.id, 'again')).toBeNull();
  });

  it('promote records the graduation, restore only works on dismissed', async () => {
    const item = await inbox.ingest(alert());
    const promoted = await inbox.promote(item.id);
    expect(promoted?.state).toBe('promoted');
    expect(promoted?.outcome_at).not.toBeNull();
    expect(await inbox.restore(item.id)).toBeNull();
  });

  it('restore clears the outcome and reopens', async () => {
    const item = await inbox.ingest(alert());
    await inbox.dismiss(item.id, 'noise');
    const restored = await inbox.restore(item.id);
    expect(restored?.state).toBe('open');
    expect(restored?.outcome_at).toBeNull();
    expect(restored?.outcome_reason).toBeNull();
  });

  it('defer snoozes, wake ends the snooze early', async () => {
    const item = await inbox.ingest(alert());
    const until = inFuture(4);
    const deferred = await inbox.defer(item.id, until);
    expect(deferred?.snoozed_until).toBe(until);
    const woken = await inbox.wake(item.id);
    expect(woken?.snoozed_until).toBeNull();
    // Waking an item that is not snoozed is a refused conditional write.
    expect(await inbox.wake(item.id)).toBeNull();
  });
});

describe('InboxRepository — lifecycle sweeps', () => {
  it('expireDue retires open events past their start, leaving future ones', async () => {
    const past = await inbox.ingest(
      alert({ kind: 'event', title: 'Upgrade window', eventStart: inPast(1) }),
    );
    const future = await inbox.ingest(
      alert({ kind: 'event', title: 'Demo', eventStart: inFuture(3) }),
    );
    await inbox.expireDue(new Date().toISOString());
    const items = await inbox.list();
    expect(items.find((i) => i.id === past.id)?.state).toBe('expired');
    expect(items.find((i) => i.id === future.id)?.state).toBe('open');
  });

  it('wakeDue resurfaces items whose snooze has elapsed', async () => {
    const item = await inbox.ingest(alert());
    await inbox.defer(item.id, inPast(1));
    await inbox.wakeDue(new Date().toISOString());
    const woken = await inbox.findById(item.id);
    expect(woken?.snoozed_until).toBeNull();
  });
});
