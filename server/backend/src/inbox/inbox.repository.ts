import { newUuid } from '@repo/shared-contracts/uuid';
import type { DatabaseService } from '../database/database.service.js';

export type InboxItemKind = 'alert' | 'transcript' | 'event' | 'note';
export type InboxItemState = 'open' | 'dismissed' | 'promoted' | 'expired';

// Internal row shape. Optional STRING columns are stored as '' and mapped to
// null here at the repository edge; `occurrences` is JSON in the column and an
// array here.
export interface InboxItemRow {
  id: string;
  kind: InboxItemKind;
  title: string;
  origin: string;
  body: string;
  dedup_key: string | null;
  event_start: string | null;
  snoozed_until: string | null;
  state: InboxItemState;
  count: number;
  occurrences: string[];
  outcome_at: string | null;
  outcome_reason: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface InboxSignalInput {
  kind: InboxItemKind;
  title: string;
  origin: string;
  body: string;
  dedupKey?: string;
  eventStart?: string;
}

// How many arrival timestamps a folded item keeps for its occurrence history.
// First seen (created_at), last seen and count survive beyond the cap.
const OCCURRENCES_CAP = 10;

// lbug returns INT64 columns as `bigint`; normalize at the repository edge.
interface RawInboxItemRow {
  id: string;
  kind: string;
  title: string;
  origin: string;
  body: string;
  dedup_key: string;
  event_start: string;
  snoozed_until: string;
  state: string;
  count: number | bigint;
  occurrences: string;
  outcome_at: string;
  outcome_reason: string;
  last_seen_at: string;
  created_at: string;
}

const RETURN_ITEM = `RETURN i.id AS id, i.kind AS kind, i.title AS title, i.origin AS origin,
         i.body AS body, i.dedup_key AS dedup_key, i.event_start AS event_start,
         i.snoozed_until AS snoozed_until, i.state AS state, i.count AS count,
         i.occurrences AS occurrences,
         i.outcome_at AS outcome_at, i.outcome_reason AS outcome_reason,
         i.last_seen_at AS last_seen_at, i.created_at AS created_at`;

/**
 * Every graph read and write behind the inbox. State transitions are
 * conditional writes (`WHERE i.state = ...`) — zero rows back means the item
 * is missing or in the wrong state, and the service above disambiguates.
 * Folding a repeat needs the current occurrence history, so `ingest` is the
 * one read-then-write here; the server is a single local writer, so it needs
 * no version guard around it (decision 65).
 */
export class InboxRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Lands a signal in the inbox. With a dedup key that matches an open item,
   * the arrival folds into it (count, last_seen_at, occurrence history);
   * anything else — no key, no open match — is a new item, never guessed into
   * an existing one.
   */
  async ingest(input: InboxSignalInput): Promise<InboxItemRow> {
    const dedupKey = input.dedupKey ?? '';
    if (dedupKey !== '') {
      const existing = await this.findOpenByDedupKey(dedupKey);
      if (existing !== null) return this.fold(existing);
    }
    return this.create(input);
  }

  private async fold(existing: InboxItemRow): Promise<InboxItemRow> {
    const now = new Date().toISOString();
    const occurrences = JSON.stringify(
      [...existing.occurrences, now].slice(-OCCURRENCES_CAP),
    );
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem {id: $id})
       WHERE i.state = 'open'
       SET i.count = i.count + 1, i.last_seen_at = $now,
           i.occurrences = $occurrences
       ${RETURN_ITEM}`,
      { id: existing.id, now, occurrences },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error(`Inbox item ${existing.id} vanished while folding.`);
    }
    return toItemRow(row);
  }

  private async create(input: InboxSignalInput): Promise<InboxItemRow> {
    const id = newUuid();
    const now = new Date().toISOString();
    const rows = await this.db.query<RawInboxItemRow>(
      `CREATE (i:InboxItem {
         id: $id, kind: $kind, title: $title, origin: $origin, body: $body,
         dedup_key: $dedupKey, event_start: $eventStart, snoozed_until: '',
         state: 'open', count: 1, occurrences: $occurrences,
         outcome_at: '', outcome_reason: '',
         last_seen_at: $now, created_at: $now
       })
       ${RETURN_ITEM}`,
      {
        id,
        kind: input.kind,
        title: input.title,
        origin: input.origin,
        body: input.body,
        dedupKey: input.dedupKey ?? '',
        eventStart: input.eventStart ?? '',
        occurrences: JSON.stringify([now]),
        now,
      },
    );
    const row = rows[0];
    if (row === undefined)
      throw new Error('Inbox item creation returned no row.');
    return toItemRow(row);
  }

  private async findOpenByDedupKey(
    dedupKey: string,
  ): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem)
       WHERE i.dedup_key = $dedupKey AND i.state = 'open'
       ${RETURN_ITEM}`,
      { dedupKey },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  async findById(id: string): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem {id: $id})
       ${RETURN_ITEM}`,
      { id },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  /** Every item, newest activity first — the client folds them into tabs. */
  async list(): Promise<InboxItemRow[]> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem)
       ${RETURN_ITEM}
       ORDER BY i.last_seen_at DESC`,
    );
    return rows.map(toItemRow);
  }

  /**
   * Retires open events whose start has passed (ISO strings compare
   * lexicographically). Expiry is a system outcome — distinct from handled —
   * so no reason is recorded.
   */
  async expireDue(now: string): Promise<void> {
    await this.db.query(
      `MATCH (i:InboxItem)
       WHERE i.state = 'open' AND i.event_start <> '' AND i.event_start <= $now
       SET i.state = 'expired', i.outcome_at = $now, i.snoozed_until = ''`,
      { now },
    );
  }

  /** Deferred items whose wake time has passed resurface on their own. */
  async wakeDue(now: string): Promise<void> {
    await this.db.query(
      `MATCH (i:InboxItem)
       WHERE i.state = 'open' AND i.snoozed_until <> ''
         AND i.snoozed_until <= $now
       SET i.snoozed_until = ''`,
      { now },
    );
  }

  /** Open → dismissed with the stored reason. Null when not open (or missing). */
  async dismiss(id: string, reason: string): Promise<InboxItemRow | null> {
    const now = new Date().toISOString();
    return this.transition(
      id,
      `WHERE i.state = 'open'
       SET i.state = 'dismissed', i.outcome_at = $now,
           i.outcome_reason = $reason, i.snoozed_until = ''`,
      { now, reason },
    );
  }

  /** Open → promoted: the graduation record the future task module picks up from. */
  async promote(id: string): Promise<InboxItemRow | null> {
    const now = new Date().toISOString();
    return this.transition(
      id,
      `WHERE i.state = 'open'
       SET i.state = 'promoted', i.outcome_at = $now, i.snoozed_until = ''`,
      { now },
    );
  }

  /** Dismissed → open again, outcome cleared — triage mistakes are recoverable. */
  async restore(id: string): Promise<InboxItemRow | null> {
    return this.transition(
      id,
      `WHERE i.state = 'dismissed'
       SET i.state = 'open', i.outcome_at = '',
           i.outcome_reason = '', i.snoozed_until = ''`,
      {},
    );
  }

  /** Snoozes an open item until `until`. Bounding by event start is the service's check. */
  async defer(id: string, until: string): Promise<InboxItemRow | null> {
    return this.transition(
      id,
      `WHERE i.state = 'open'
       SET i.snoozed_until = $until`,
      { until },
    );
  }

  /** Ends a snooze early. */
  async wake(id: string): Promise<InboxItemRow | null> {
    return this.transition(
      id,
      `WHERE i.state = 'open' AND i.snoozed_until <> ''
       SET i.snoozed_until = ''`,
      {},
    );
  }

  private async transition(
    id: string,
    clause: string,
    params: Record<string, string>,
  ): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem {id: $id})
       ${clause}
       ${RETURN_ITEM}`,
      { id, ...params },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }
}

function toItemRow(raw: RawInboxItemRow): InboxItemRow {
  return {
    id: raw.id,
    kind: toKind(raw.kind),
    title: raw.title,
    origin: raw.origin,
    body: raw.body,
    dedup_key: emptyToNull(raw.dedup_key),
    event_start: emptyToNull(raw.event_start),
    snoozed_until: emptyToNull(raw.snoozed_until),
    state: toState(raw.state),
    count: Number(raw.count),
    occurrences: parseOccurrences(raw.occurrences),
    outcome_at: emptyToNull(raw.outcome_at),
    outcome_reason: emptyToNull(raw.outcome_reason),
    last_seen_at: raw.last_seen_at,
    created_at: raw.created_at,
  };
}

function emptyToNull(value: string): string | null {
  return value === '' ? null : value;
}

function toKind(value: string): InboxItemKind {
  switch (value) {
    case 'alert':
    case 'transcript':
    case 'event':
    case 'note':
      return value;
    default:
      throw new Error(`Unknown inbox item kind "${value}".`);
  }
}

function toState(value: string): InboxItemState {
  switch (value) {
    case 'open':
    case 'dismissed':
    case 'promoted':
    case 'expired':
      return value;
    default:
      throw new Error(`Unknown inbox item state "${value}".`);
  }
}

function parseOccurrences(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed)
    ? parsed.filter((t) => typeof t === 'string')
    : [];
}
