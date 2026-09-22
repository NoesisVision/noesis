import type { Result } from 'neverthrow';

/** The value of a result the spec expects to succeed; throws, failing the spec, if it did not. */
export async function okOf<T, E>(
  result: PromiseLike<Result<T, E>>,
): Promise<T> {
  return (await result)._unsafeUnwrap();
}

/** The error of a result the spec expects to fail; throws, failing the spec, if it did not. */
export async function errOf<T, E>(
  result: PromiseLike<Result<T, E>>,
): Promise<E> {
  return (await result)._unsafeUnwrapErr();
}
