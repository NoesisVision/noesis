import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createApp } from '../../src/app.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { InboxRepository } from '../../src/inbox/inbox.repository.js';
import { InboxService } from '../../src/inbox/inbox.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The /ui/inbox surface over the composed app. Items are top-level: the server
// serves the one checkout it was started in (decision 65).

let db: DatabaseService;

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function app() {
  return createApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
    inboxService: new InboxService(new InboxRepository(db)),
  });
}

function post(body?: unknown) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

interface ItemDto {
  id: string;
  kind: string;
  title: string;
  origin: string;
  state: string;
  count: number;
  snoozedUntil: string | null;
  eventStart: string | null;
  outcome: { at: string; reason: string | null } | null;
}

async function item(res: Response): Promise<ItemDto> {
  expect([200, 201]).toContain(res.status);
  return ((await res.json()) as { item: ItemDto }).item;
}

const inFuture = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000).toISOString();
const inPast = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

describe('/ui/inbox', () => {
  it('capture lands a note', async () => {
    const a = app();
    const created = await item(
      await a.request(
        '/ui/inbox',
        post({ kind: 'note', title: 'Rate limiter too permissive' }),
      ),
    );
    expect(created.kind).toBe('note');
    expect(created.state).toBe('open');

    const list = await a.request('/ui/inbox');
    expect(list.status).toBe(200);
    const { items } = (await list.json()) as { items: ItemDto[] };
    expect(items).toHaveLength(1);
  });

  it('signals fold by dedup key and an event needs its start', async () => {
    const a = app();
    const signal = {
      kind: 'alert',
      title: 'Nightly backup failed',
      origin: 'cron',
      dedupKey: 'backup-nightly',
    };
    const first = await item(
      await a.request('/ui/inbox/signals', post(signal)),
    );
    const second = await item(
      await a.request('/ui/inbox/signals', post(signal)),
    );
    expect(second.id).toBe(first.id);
    expect(second.count).toBe(2);

    const noStart = await a.request(
      '/ui/inbox/signals',
      post({ kind: 'event', title: 'Security review', origin: 'calendar' }),
    );
    expect(noStart.status).toBe(400);
  });

  it('dismiss requires a reason and refuses a repeat', async () => {
    const a = app();
    const created = await item(
      await a.request('/ui/inbox', post({ kind: 'note', title: 'Noise' })),
    );

    const noReason = await a.request(
      `/ui/inbox/${created.id}/dismiss`,
      post({ reason: '   ' }),
    );
    expect(noReason.status).toBe(400);

    const dismissed = await item(
      await a.request(
        `/ui/inbox/${created.id}/dismiss`,
        post({ reason: 'already tracked elsewhere' }),
      ),
    );
    expect(dismissed.state).toBe('dismissed');
    expect(dismissed.outcome?.reason).toBe('already tracked elsewhere');

    const again = await a.request(
      `/ui/inbox/${created.id}/dismiss`,
      post({ reason: 'twice' }),
    );
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe(
      'invalid_state',
    );

    const restored = await item(
      await a.request(`/ui/inbox/${created.id}/restore`, post()),
    );
    expect(restored.state).toBe('open');
    expect(restored.outcome).toBeNull();
  });

  it('defer is bounded by an event start; wake ends a snooze', async () => {
    const a = app();
    const start = inFuture(2);
    const event = await item(
      await a.request(
        '/ui/inbox/signals',
        post({
          kind: 'event',
          title: 'Stakeholder demo',
          origin: 'calendar',
          eventStart: start,
        }),
      ),
    );

    const tooLate = await a.request(
      `/ui/inbox/${event.id}/defer`,
      post({ until: inFuture(3) }),
    );
    expect(tooLate.status).toBe(400);
    expect(((await tooLate.json()) as { error: string }).error).toBe(
      'defer_past_event_start',
    );

    const until = inFuture(1);
    const deferred = await item(
      await a.request(`/ui/inbox/${event.id}/defer`, post({ until })),
    );
    expect(deferred.snoozedUntil).toBe(until);

    const woken = await item(
      await a.request(`/ui/inbox/${event.id}/wake`, post()),
    );
    expect(woken.snoozedUntil).toBeNull();
  });

  it('promote graduates the item', async () => {
    const a = app();
    const created = await item(
      await a.request(
        '/ui/inbox',
        post({ kind: 'note', title: 'Add missing index' }),
      ),
    );
    const promoted = await item(
      await a.request(`/ui/inbox/${created.id}/promote`, post()),
    );
    expect(promoted.state).toBe('promoted');
    expect(promoted.outcome?.at).not.toBeNull();
  });

  it('listing sweeps lifecycle state: overdue events expire on read', async () => {
    const a = app();
    const overdue = await item(
      await a.request(
        '/ui/inbox/signals',
        post({
          kind: 'event',
          title: 'Upgrade window',
          origin: 'calendar',
          eventStart: inPast(1),
        }),
      ),
    );
    // Ingest does not judge the past — the read sweep does.
    expect(overdue.state).toBe('open');

    const list = await a.request('/ui/inbox');
    const { items } = (await list.json()) as { items: ItemDto[] };
    expect(items.find((i) => i.id === overdue.id)?.state).toBe('expired');
  });

  it('answers 404 for an unknown item', async () => {
    const a = app();
    expect((await a.request('/ui/inbox/nope/promote', post())).status).toBe(
      404,
    );
  });
});
