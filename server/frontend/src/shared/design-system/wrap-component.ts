import { type ComponentProps, createElement, type ElementType } from 'react';

// React 19 passes refs through props, so a plain wrapper suffices. Mantine's
// static helpers are copied over; React's render internals are not.
export function wrapComponent<T extends ElementType, Props = never>(
  Component: T,
  name: string,
  /**
   * What the wrapper is for when nothing at the call site says otherwise.
   * A prop passed in replaces the default outright, `className` and `style`
   * included, so a default is a starting point and never a floor.
   *
   * `Props` has to be named — `wrapComponent<typeof Card, CardProps>(…)`.
   * `ComponentProps` reads a Mantine polymorphic component as `{}`, which
   * would take a misspelled prop without a word, so the props interface is
   * asked for rather than derived.
   */
  defaults?: NoInfer<[Props] extends [never] ? never : Partial<Props>>,
): T {
  function Wrapped(props: ComponentProps<T>) {
    return createElement(Component, { ...defaults, ...props });
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
