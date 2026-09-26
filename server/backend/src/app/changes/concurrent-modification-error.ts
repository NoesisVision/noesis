import type { ChangeId } from '#backend/app/changes/model/change-id';

/**
 * A save of a change read before another save of it. Surfaced, never retried:
 * the caller reads the change again and decides what to write.
 */
export class ConcurrentModificationError extends Error {
  readonly change: ChangeId;

  constructor(change: ChangeId) {
    super(
      `Change ${JSON.stringify(change)} was saved by someone else after it was read.`,
    );
    this.name = 'ConcurrentModificationError';
    this.change = change;
  }
}
