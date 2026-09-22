/**
 * Runs tasks one at a time, in the order they were handed in. A service whose
 * write follows a uniqueness check puts both through here: an agent fires tool
 * calls in parallel, and two checks that both pass would let the second write
 * replace the first. One process owns `.noesis/` writes, so in-process order is
 * enough.
 */
export class Serial {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => PromiseLike<T>): Promise<T> {
    const result = this.tail.then(task, task);
    // A failed task must not poison the ones queued behind it.
    this.tail = result.catch(() => undefined);
    return result;
  }
}
