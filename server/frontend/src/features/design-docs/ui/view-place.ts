import type { SelectSource } from '#/shared/ui/model-tree/use-model-tree.ts';

/**
 * Where the reader is in a view that reads the document through a tree of its
 * own, and what they are looking for, as the address has it.
 */
export interface ViewPlace {
  /** The row in hand; null for the top. */
  selected: string | null;
  query: string;
  onSelect: (path: string, source: SelectSource) => void;
  onQuery: (query: string) => void;
}
