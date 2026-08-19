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
  outcome_by: string | null;
  outcome_at: string | null;
  outcome_reason: string | null;
  last_seen_at: string;
  version: number;
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
  outcome_by: string;
  outcome_at: string;
  outcome_reason: string;
  last_seen_at: string;
  version: number | bigint;
  created_at: string;
}

const RETURN_ITEM = `RETURN i.id AS id, i.kind AS kind, i.title AS title, i.origin AS origin,
         i.body AS body, i.dedup_key AS dedup_key, i.event_start AS event_start,
         i.snoozed_until AS snoozed_until, i.state AS state, i.count AS count,
         i.occurrences AS occurrences, i.outcome_by AS outcome_by,
         i.outcome_at AS outcome_at, i.outcome_reason AS outcome_reason,
         i.last_seen_at AS last_seen_at, i.version AS version,
         i.created_at AS created_at`;

/**
 * Every graph read and write behind a project's inbox. State transitions are
 * conditional writes (`WHERE i.state = ...`) — zero rows back means the item
 * is missing or in the wrong state, and the service above disambiguates.
 * Folding a repeat needs the current occurrence history, so `ingest` is the
 * one read-then-write here, guarded by the row version and retried once.
 */
export class InboxRepository {
  private readonly db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Lands a signal in the project's inbox. With a dedup key that matches an
   * open item, the arrival folds into it (count, last_seen_at, occurrence
   * history); anything else — no key, no open match — is a new item, never
   * guessed into an existing one. Returns null when the project is missing.
   */
  async ingest(
    projectId: string,
    input: InboxSignalInput,
  ): Promise<InboxItemRow | null> {
    const dedupKey = input.dedupKey ?? '';
    for (let attempt = 0; attempt < 2; attempt++) {
      if (dedupKey !== '') {
        const existing = await this.findOpenByDedupKey(projectId, dedupKey);
        if (existing !== null) {
          const folded = await this.fold(existing);
          if (folded !== null) return folded;
          continue; // version raced — re-read and retry once
        }
      }
      return this.create(projectId, input);
    }
    // Two lost races in a row on a single-writer server should not happen.
    throw new Error('Inbox ingest kept losing the version race.');
  }

  private async fold(existing: InboxItemRow): Promise<InboxItemRow | null> {
    const now = new Date().toISOString();
    const occurrences = JSON.stringify(
      [...existing.occurrences, now].slice(-OCCURRENCES_CAP),
    );
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (i:InboxItem {id: $id})
       WHERE i.version = $expectedVersion AND i.state = 'open'
       SET i.count = i.count + 1, i.last_seen_at = $now,
           i.occurrences = $occurrences, i.version = i.version + 1
       ${RETURN_ITEM}`,
      {
        id: existing.id,
        expectedVersion: existing.version,
        now,
        occurrences,
      },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  private async create(
    projectId: string,
    input: InboxSignalInput,
  ): Promise<InboxItemRow | null> {
    const id = newUuid();
    const now = new Date().toISOString();
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (p:Project {id: $projectId})
       CREATE (i:InboxItem {
         id: $id, kind: $kind, title: $title, origin: $origin, body: $body,
         dedup_key: $dedupKey, event_start: $eventStart, snoozed_until: '',
         state: 'open', count: 1, occurrences: $occurrences,
         outcome_by: '', outcome_at: '', outcome_reason: '',
         last_seen_at: $now, version: 0, created_at: $now
       })
       CREATE (p)-[:HasInboxItem]->(i)
       ${RETURN_ITEM}`,
      {
        projectId,
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
    return row ? toItemRow(row) : null;
  }

  private async findOpenByDedupKey(
    projectId: string,
    dedupKey: string,
  ): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem)
       WHERE i.dedup_key = $dedupKey AND i.state = 'open'
       ${RETURN_ITEM}`,
      { projectId, dedupKey },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  async findById(projectId: string, id: string): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem {id: $id})
       ${RETURN_ITEM}`,
      { projectId, id },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  /** Every item, newest activity first — the client folds them into tabs. */
  async listByProject(projectId: string): Promise<InboxItemRow[]> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem)
       ${RETURN_ITEM}
       ORDER BY i.last_seen_at DESC`,
      { projectId },
    );
    return rows.map(toItemRow);
  }

  /**
   * Retires open events whose start has passed (ISO strings compare
   * lexicographically). Expiry is a system outcome — distinct from handled —
   * so outcome_by stays empty.
   */
  async expireDue(projectId: string, now: string): Promise<void> {
    await this.db.query(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem)
       WHERE i.state = 'open' AND i.event_start <> '' AND i.event_start <= $now
       SET i.state = 'expired', i.outcome_at = $now, i.snoozed_until = '',
           i.version = i.version + 1`,
      { projectId, now },
    );
  }

  /** Deferred items whose wake time has passed resurface on their own. */
  async wakeDue(projectId: string, now: string): Promise<void> {
    await this.db.query(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem)
       WHERE i.state = 'open' AND i.snoozed_until <> ''
         AND i.snoozed_until <= $now
       SET i.snoozed_until = '', i.version = i.version + 1`,
      { projectId, now },
    );
  }

  /** Open → dismissed with the stored reason. Null when not open (or missing). */
  async dismiss(
    projectId: string,
    id: string,
    by: string,
    reason: string,
  ): Promise<InboxItemRow | null> {
    const now = new Date().toISOString();
    return this.transition(
      projectId,
      id,
      `WHERE i.state = 'open'
       SET i.state = 'dismissed', i.outcome_by = $by, i.outcome_at = $now,
           i.outcome_reason = $reason, i.snoozed_until = '',
           i.version = i.version + 1`,
      { by, now, reason },
    );
  }

  /** Open → promoted: the graduation record the future task module picks up from. */
  async promote(
    projectId: string,
    id: string,
    by: string,
  ): Promise<InboxItemRow | null> {
    const now = new Date().toISOString();
    return this.transition(
      projectId,
      id,
      `WHERE i.state = 'open'
       SET i.state = 'promoted', i.outcome_by = $by, i.outcome_at = $now,
           i.snoozed_until = '', i.version = i.version + 1`,
      { by, now },
    );
  }

  /** Dismissed → open again, outcome cleared — triage mistakes are recoverable. */
  async restore(projectId: string, id: string): Promise<InboxItemRow | null> {
    return this.transition(
      projectId,
      id,
      `WHERE i.state = 'dismissed'
       SET i.state = 'open', i.outcome_by = '', i.outcome_at = '',
           i.outcome_reason = '', i.snoozed_until = '',
           i.version = i.version + 1`,
      {},
    );
  }

  /** Snoozes an open item until `until`. Bounding by event start is the service's check. */
  async defer(
    projectId: string,
    id: string,
    until: string,
  ): Promise<InboxItemRow | null> {
    return this.transition(
      projectId,
      id,
      `WHERE i.state = 'open'
       SET i.snoozed_until = $until, i.version = i.version + 1`,
      { until },
    );
  }

  /** Ends a snooze early. */
  async wake(projectId: string, id: string): Promise<InboxItemRow | null> {
    return this.transition(
      projectId,
      id,
      `WHERE i.state = 'open' AND i.snoozed_until <> ''
       SET i.snoozed_until = '', i.version = i.version + 1`,
      {},
    );
  }

  private async transition(
    projectId: string,
    id: string,
    clause: string,
    params: Record<string, string>,
  ): Promise<InboxItemRow | null> {
    const rows = await this.db.query<RawInboxItemRow>(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem {id: $id})
       ${clause}
       ${RETURN_ITEM}`,
      { projectId, id, ...params },
    );
    const row = rows[0];
    return row ? toItemRow(row) : null;
  }

  /** Project deletion takes its inbox along — items exist only under their project. */
  async deleteByProject(projectId: string): Promise<void> {
    await this.db.query(
      `MATCH (:Project {id: $projectId})-[:HasInboxItem]->(i:InboxItem)
       DETACH DELETE i`,
      { projectId },
    );
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
    outcome_by: emptyToNull(raw.outcome_by),
    outcome_at: emptyToNull(raw.outcome_at),
    outcome_reason: emptyToNull(raw.outcome_reason),
    last_seen_at: raw.last_seen_at,
    version: Number(raw.version),
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
