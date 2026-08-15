// Optimistic concurrency (OQ-2.3): every mutable row carries a `version`.
// A mutating query matches on the expected version and increments it; if no row
// matches, a concurrent writer won. Repositories surface that as this error so
// the caller (or the client that supplied the stale version) can reload + retry.
export class ConcurrencyConflictError extends Error {
  readonly entity: string;
  readonly id: string;

  constructor(entity: string, id: string) {
    super(`Concurrent modification of ${entity} ${id}; reload and retry.`);
    this.name = 'ConcurrencyConflictError';
    this.entity = entity;
    this.id = id;
  }
}
