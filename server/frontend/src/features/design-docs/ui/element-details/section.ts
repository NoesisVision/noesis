import { type ComponentType, createElement, type ReactElement } from 'react';

/**
 * A section of the detail panel. One that may have nothing to show carries a
 * `shows` guard beside it, in its own file, so the rule for when it appears
 * lives with the markup it guards.
 */
export type Section<Props> = ComponentType<Props> & {
  shows?: (props: Props) => boolean;
};

/**
 * A section as an aggregator lists it: one keyed element, or none when its
 * guard says there is nothing to show. Leaving it out rather than letting it
 * render nothing keeps the divider between two sections from standing beside
 * an empty one — and lets an aggregator list every section the same way,
 * without knowing which of them are guarded.
 */
export function section<Props extends object>(
  Component: Section<Props>,
  key: string,
  props: Props,
): ReactElement[] {
  if (Component.shows && !Component.shows(props)) return [];
  return [createElement(Component, { ...props, key })];
}
