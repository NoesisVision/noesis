import type {
  InboxItemRow,
  InboxItemState,
  InboxRepository,
  InboxSignalInput,
} from './inbox.repository.js';

export interface CaptureInput {
  kind: 'note' | 'transcript';
  title: string;
  body: string;
  origin: string;
}

/** Item and project both checked; carries which one was missing. */
export class InboxItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Inbox item ${id} not found.`);
    this.name = 'InboxItemNotFoundError';
  }
}

/** The transition was refused because the item is not in the required state. */
export class InvalidInboxStateError extends Error {
  readonly state: InboxItemState;

  constructor(id: string, state: InboxItemState) {
    super(`Inbox item ${id} is ${state}.`);
    this.name = 'InvalidInboxStateError';
    this.state = state;
  }
}

/** A snooze may never skip past the moment the item exists for (inbox.md §4). */
export class DeferPastEventStartError extends Error {
  readonly eventStart: string;

  constructor(id: string, eventStart: string) {
    super(`Deferral of ${id} would pass the event start ${eventStart}.`);
    this.name = 'DeferPastEventStartError';
    this.eventStart = eventStart;
  }
}

/**
 * The inbox lifecycle over the repository's conditional writes. Reads sweep
 * first — events past their start expire, elapsed snoozes wake — so what a
 * client renders is already in its true state without a background job.
 */
export class InboxService {
  private readonly repository: InboxRepository;

  constructor(repository: InboxRepository) {
    this.repository = repository;
  }

  async list(): Promise<InboxItemRow[]> {
    const now = new Date().toISOString();
    await this.repository.expireDue(now);
    await this.repository.wakeDue(now);
    return this.repository.list();
  }

  /** Manual capture: a note, or a transcript when a file's content came along. */
  async capture(input: CaptureInput): Promise<InboxItemRow> {
    return this.repository.ingest({
      kind: input.kind,
      title: input.title,
      origin: input.origin,
      body: input.body,
    });
  }

  /**
   * Source-agnostic intake (alerts, events, pushed transcripts): repeats fold
   * by the sender's dedup key, everything else lands as a new item.
   */
  async ingest(input: InboxSignalInput): Promise<InboxItemRow> {
    return this.repository.ingest(input);
  }

  async dismiss(id: string, reason: string): Promise<InboxItemRow> {
    const item = await this.repository.dismiss(id, reason);
    return item ?? this.refuse(id);
  }

  async promote(id: string): Promise<InboxItemRow> {
    const item = await this.repository.promote(id);
    return item ?? this.refuse(id);
  }

  async restore(id: string): Promise<InboxItemRow> {
    const item = await this.repository.restore(id);
    return item ?? this.refuse(id);
  }

  async defer(id: string, until: string): Promise<InboxItemRow> {
    const current = await this.repository.findById(id);
    if (current === null) throw new InboxItemNotFoundError(id);
    if (current.event_start !== null && until >= current.event_start) {
      throw new DeferPastEventStartError(id, current.event_start);
    }
    const item = await this.repository.defer(id, until);
    return item ?? this.refuse(id);
  }

  async wake(id: string): Promise<InboxItemRow> {
    const item = await this.repository.wake(id);
    return item ?? this.refuse(id);
  }

  /** Zero rows from a conditional write, told apart: missing item or wrong state. */
  private async refuse(id: string): Promise<never> {
    const current = await this.repository.findById(id);
    if (current === null) throw new InboxItemNotFoundError(id);
    throw new InvalidInboxStateError(id, current.state);
  }
}
