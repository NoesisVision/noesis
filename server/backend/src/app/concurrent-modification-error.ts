/**
 * A save of an aggregate read before another save of it. Surfaced, never
 * retried: the caller reads the aggregate again and decides what to write.
 */
export class ConcurrentModificationError extends Error {
  /** The kind of aggregate, as a message names it: `change`. */
  readonly entity: string;
  readonly id: string;

  constructor(entity: string, id: string) {
    super(
      `The ${entity} ${JSON.stringify(id)} was saved by someone else after it was read.`,
    );
    this.name = 'ConcurrentModificationError';
    this.entity = entity;
    this.id = id;
  }
}
