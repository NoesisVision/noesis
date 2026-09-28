import { createContext, useContext } from 'react';

/**
 * How a section inside the panel takes the reader to another element, as the
 * tree itself would. Given through context rather than props, so the
 * aggregators that list the sections never learn about it.
 */
export interface ElementNavigation {
  /** Whether the tree has a row at the path, which is all that can be opened. */
  has: (path: string) => boolean;
  select: (path: string) => void;
}

export const ElementNavigationContext = createContext<ElementNavigation>({
  has: () => false,
  select: () => {},
});

export const useElementNavigation = () => useContext(ElementNavigationContext);
