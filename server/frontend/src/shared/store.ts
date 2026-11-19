import { useSyncExternalStore } from 'react';

/*
 * A value held outside React, so that each reader takes its own part of it
 * and renders again only when that part changes. Handed down as props or
 * through a context, the same value renders every reader on every change.
 */

export interface Store<T> {
  readonly get: () => T;
  readonly set: (next: T) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (Object.is(next, current)) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * One piece of a store's value, for one reader. The selector must return a
 * primitive or a reference that holds still, or the reader renders every time.
 */
export function useStoreValue<T, P>(
  store: Pick<Store<T>, 'get' | 'subscribe'>,
  select: (value: T) => P,
): P {
  const read = () => select(store.get());
  return useSyncExternalStore(store.subscribe, read, read);
}
