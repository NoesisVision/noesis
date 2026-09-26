import type { ChangeId } from './changes/change-id';

/** What a lookup looks for, as a message names it. */
export type Entity = 'change' | 'document' | 'design document';

/**
 * An id that names nothing. Every service throws it for a missing entity, and
 * each adapter answers it once, where it catches every error.
 */
export class NotFoundError extends Error {
  readonly entity: Entity;
  readonly id: string;
  /** The change an entry was looked for in; absent for a change itself. */
  readonly change: ChangeId | undefined;

  constructor(entity: Entity, id: string, change?: ChangeId) {
    const where =
      change === undefined ? '' : ` in change ${JSON.stringify(change)}`;
    super(`No ${entity} ${JSON.stringify(id)}${where}.`);
    this.name = 'NotFoundError';
    this.entity = entity;
    this.id = id;
    this.change = change;
  }
}
