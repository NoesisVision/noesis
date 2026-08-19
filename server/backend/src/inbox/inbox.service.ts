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

export class ProjectNotFoundForInboxError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found.`);
    this.name = 'ProjectNotFoundForInboxError';
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

  async list(projectId: string): Promise<InboxItemRow[]> {
    const now = new Date().toISOString();
    await this.repository.expireDue(projectId, now);
    await this.repository.wakeDue(projectId, now);
    return this.repository.listByProject(projectId);
  }

  /** Manual capture: a note, or a transcript when a file's content came along. */
  async capture(projectId: string, input: CaptureInput): Promise<InboxItemRow> {
    const item = await this.repository.ingest(projectId, {
      kind: input.kind,
      title: input.title,
      origin: input.origin,
      body: input.body,
    });
    if (item === null) throw new ProjectNotFoundForInboxError(projectId);
    return item;
  }

  /**
   * Source-agnostic intake (alerts, events, pushed transcripts): repeats fold
   * by the sender's dedup key, everything else lands as a new item.
   */
  async ingest(
    projectId: string,
    input: InboxSignalInput,
  ): Promise<InboxItemRow> {
    const item = await this.repository.ingest(projectId, input);
    if (item === null) throw new ProjectNotFoundForInboxError(projectId);
    return item;
  }

  async dismiss(
    projectId: string,
    id: string,
    by: string,
    reason: string,
  ): Promise<InboxItemRow> {
    const item = await this.repository.dismiss(projectId, id, by, reason);
    return item ?? this.refuse(projectId, id);
  }

  async promote(
    projectId: string,
    id: string,
    by: string,
  ): Promise<InboxItemRow> {
    const item = await this.repository.promote(projectId, id, by);
    return item ?? this.refuse(projectId, id);
  }

  async restore(projectId: string, id: string): Promise<InboxItemRow> {
    const item = await this.repository.restore(projectId, id);
    if (item !== null) return item;
    const current = await this.repository.findById(projectId, id);
    if (current === null) throw new InboxItemNotFoundError(id);
    throw new InvalidInboxStateError(id, current.state);
  }

  async defer(
    projectId: string,
    id: string,
    until: string,
  ): Promise<InboxItemRow> {
    const current = await this.repository.findById(projectId, id);
    if (current === null) throw new InboxItemNotFoundError(id);
    if (current.event_start !== null && until >= current.event_start) {
      throw new DeferPastEventStartError(id, current.event_start);
    }
    const item = await this.repository.defer(projectId, id, until);
    return item ?? this.refuse(projectId, id);
  }

  async wake(projectId: string, id: string): Promise<InboxItemRow> {
    const item = await this.repository.wake(projectId, id);
    return item ?? this.refuse(projectId, id);
  }

  /** Zero rows from a conditional write, told apart: missing item or wrong state. */
  private async refuse(projectId: string, id: string): Promise<never> {
    const current = await this.repository.findById(projectId, id);
    if (current === null) throw new InboxItemNotFoundError(id);
    throw new InvalidInboxStateError(id, current.state);
  }
}
