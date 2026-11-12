import { createContext, useContext } from 'react';
import '@xyflow/react/dist/base.css';

/*
 * Where each box stands to the selection or the step being played, as the
 * canvas tells its boxes.
 */

export interface Reading {
  selected: ReadonlySet<string>;
  /** What stays clear while something is in hand; none with nothing in hand. */
  clear: ReadonlySet<string> | null;
  related: ReadonlySet<string>;
  path: ReadonlySet<string>;
  /** The lines drawn over the rest while a step plays; none otherwise. */
  lines?: ReadonlySet<string>;
  onClick: (id: string, adding: boolean) => void;
}

export const ReadingContext = createContext<Reading>({
  selected: new Set(),
  clear: null,
  related: new Set(),
  path: new Set(),
  onClick: () => {},
});

export function useBoxState(id: string) {
  const { selected, clear, related, path, onClick } =
    useContext(ReadingContext);
  return {
    state: selected.has(id)
      ? ('selected' as const)
      : path.has(id)
        ? ('path' as const)
        : related.has(id)
          ? ('related' as const)
          : undefined,
    dimmed: clear !== null && !clear.has(id),
    onClick,
  };
}

export const pressed = (event: { ctrlKey: boolean; metaKey: boolean }) =>
  event.ctrlKey || event.metaKey;
