import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { DatabaseService } from '../../src/database/database.service.js';
import {
  InboxRepository,
  type InboxSignalInput,
} from '../../src/inbox/inbox.repository.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The inbox lifecycle at the repository layer: dedup folding, the conditional
// state transitions, and the lifecycle sweeps (expiry, wake).

let db: DatabaseService;
let inbox: InboxRepository;
let projects: ProjectsRepository;

beforeAll(async () => {
  db = await sharedTestDatabase();
  inbox = new InboxRepository(db);
  projects = new ProjectsRepository(db);
});

afterEach(resetGraph);

async function projectId(name = 'Noesis'): Promise<string> {
  const project = await projects.create(name);
  if (project === null) throw new Error('project create refused');
  return project.id;
}

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
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert({ dedupKey: 'cpu-billing' }));
    expect(item).not.toBeNull();
    expect(item?.state).toBe('open');
    expect(item?.count).toBe(1);
    expect(item?.occurrences).toHaveLength(1);
    expect(item?.dedup_key).toBe('cpu-billing');
  });

  it('folds a repeat with the same dedup key into the existing item', async () => {
    const pid = await projectId();
    const first = await inbox.ingest(pid, alert({ dedupKey: 'cpu-billing' }));
    const second = await inbox.ingest(pid, alert({ dedupKey: 'cpu-billing' }));
    expect(second?.id).toBe(first?.id as string);
    expect(second?.count).toBe(2);
    expect(second?.occurrences).toHaveLength(2);
    expect(await inbox.listByProject(pid)).toHaveLength(1);
  });

  it('treats a signal without a dedup key as a new item every time', async () => {
    const pid = await projectId();
    await inbox.ingest(pid, alert());
    await inbox.ingest(pid, alert());
    expect(await inbox.listByProject(pid)).toHaveLength(2);
  });

  it('does not fold across projects', async () => {
    const a = await projectId('A');
    const b = await projectId('B');
    await inbox.ingest(a, alert({ dedupKey: 'shared' }));
    const item = await inbox.ingest(b, alert({ dedupKey: 'shared' }));
    expect(item?.count).toBe(1);
    expect(await inbox.listByProject(b)).toHaveLength(1);
  });

  it('a repeat after dismissal starts a new item, not a reopen', async () => {
    const pid = await projectId();
    const first = await inbox.ingest(pid, alert({ dedupKey: 'cpu' }));
    await inbox.dismiss(pid, first?.id as string, 'Ada', 'known issue');
    const second = await inbox.ingest(pid, alert({ dedupKey: 'cpu' }));
    expect(second?.id).not.toBe(first?.id as string);
    expect(second?.count).toBe(1);
  });

  it('caps the stored occurrence history while count keeps counting', async () => {
    const pid = await projectId();
    let last = null;
    for (let i = 0; i < 12; i++) {
      last = await inbox.ingest(pid, alert({ dedupKey: 'noisy' }));
    }
    expect(last?.count).toBe(12);
    expect(last?.occurrences).toHaveLength(10);
  });

  it('returns null for a missing project', async () => {
    expect(await inbox.ingest('nope', alert())).toBeNull();
  });
});

describe('InboxRepository — state transitions', () => {
  it('dismiss records the outcome and refuses a second dismissal', async () => {
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert());
    const dismissed = await inbox.dismiss(
      pid,
      item?.id as string,
      'Ada',
      'duplicate of the pager alert',
    );
    expect(dismissed?.state).toBe('dismissed');
    expect(dismissed?.outcome_by).toBe('Ada');
    expect(dismissed?.outcome_reason).toBe('duplicate of the pager alert');
    expect(dismissed?.outcome_at).not.toBeNull();
    expect(
      await inbox.dismiss(pid, item?.id as string, 'Mira', 'again'),
    ).toBeNull();
  });

  it('promote records the graduation, restore only works on dismissed', async () => {
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert());
    const promoted = await inbox.promote(pid, item?.id as string, 'Mira');
    expect(promoted?.state).toBe('promoted');
    expect(promoted?.outcome_by).toBe('Mira');
    expect(await inbox.restore(pid, item?.id as string)).toBeNull();
  });

  it('restore clears the outcome and reopens', async () => {
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert());
    await inbox.dismiss(pid, item?.id as string, 'Ada', 'noise');
    const restored = await inbox.restore(pid, item?.id as string);
    expect(restored?.state).toBe('open');
    expect(restored?.outcome_at).toBeNull();
    expect(restored?.outcome_reason).toBeNull();
  });

  it('defer snoozes, wake ends the snooze early', async () => {
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert());
    const until = inFuture(4);
    const deferred = await inbox.defer(pid, item?.id as string, until);
    expect(deferred?.snoozed_until).toBe(until);
    const woken = await inbox.wake(pid, item?.id as string);
    expect(woken?.snoozed_until).toBeNull();
    // Waking an item that is not snoozed is a refused conditional write.
    expect(await inbox.wake(pid, item?.id as string)).toBeNull();
  });
});

describe('InboxRepository — lifecycle sweeps', () => {
  it('expireDue retires open events past their start, leaving future ones', async () => {
    const pid = await projectId();
    const past = await inbox.ingest(
      pid,
      alert({ kind: 'event', title: 'Upgrade window', eventStart: inPast(1) }),
    );
    const future = await inbox.ingest(
      pid,
      alert({ kind: 'event', title: 'Demo', eventStart: inFuture(3) }),
    );
    await inbox.expireDue(pid, new Date().toISOString());
    const items = await inbox.listByProject(pid);
    expect(items.find((i) => i.id === past?.id)?.state).toBe('expired');
    expect(items.find((i) => i.id === future?.id)?.state).toBe('open');
  });

  it('wakeDue resurfaces items whose snooze has elapsed', async () => {
    const pid = await projectId();
    const item = await inbox.ingest(pid, alert());
    await inbox.defer(pid, item?.id as string, inPast(1));
    await inbox.wakeDue(pid, new Date().toISOString());
    const woken = await inbox.findById(pid, item?.id as string);
    expect(woken?.snoozed_until).toBeNull();
  });

  it('project deletion takes the inbox along', async () => {
    const pid = await projectId();
    await inbox.ingest(pid, alert());
    await projects.delete(pid);
    const orphans = await db.query<{ n: number | bigint }>(
      `MATCH (i:InboxItem) RETURN count(i) AS n`,
    );
    expect(Number(orphans[0]?.n)).toBe(0);
  });
});
