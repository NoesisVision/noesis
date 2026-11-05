/**
 * Values pushed from one side and read from the other as an async iterable:
 * the stream of a person's messages, read by a session as they arrive.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private waiting: ((result: IteratorResult<T>) => void) | undefined;
  private ended = false;

  push(value: T): void {
    if (this.ended) return;
    if (this.waiting === undefined) {
      this.values.push(value);
      return;
    }
    const resolve = this.waiting;
    this.waiting = undefined;
    resolve({ value, done: false });
  }

  end(): void {
    this.ended = true;
    const resolve = this.waiting;
    this.waiting = undefined;
    resolve?.({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) {
          return Promise.resolve({ value, done: false });
        }
        if (this.ended) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => {
          this.waiting = resolve;
        });
      },
    };
  }
}
