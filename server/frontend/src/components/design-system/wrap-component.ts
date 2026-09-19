import { type ComponentProps, createElement, type ElementType } from 'react';

// React 19 passes refs through props, so a plain wrapper suffices. Mantine's
// static helpers are copied over; React's render internals are not.
export function wrapComponent<T extends ElementType>(
  Component: T,
  name: string,
): T {
  function Wrapped(props: ComponentProps<T>) {
    return createElement(Component, props);
  }
  for (const [key, value] of Object.entries(Component)) {
    if (
      !['$$typeof', 'render', 'compare', 'type', 'displayName'].includes(key)
    ) {
      Object.defineProperty(Wrapped, key, {
        value,
        writable: true,
        configurable: true,
      });
    }
  }
  Wrapped.displayName = `DesignSystem.${name}`;
  return Wrapped as unknown as T;
}
