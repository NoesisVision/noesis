import { type RefObject, useCallback, useEffect, useRef } from 'react';
import type { OutlineNode } from './model-outline.ts';
import { revealRow } from './reveal-row.ts';
import {
  type ModelTreeController,
  type ModelTreeState,
  type SelectSource,
  useModelTree,
} from './use-model-tree.ts';

export interface Following {
  /**
   * What else follows the reading position: told the row arrived at, before
   * the tree is scrolled to it. Keep it stable.
   */
  readonly onArrive?: (path: string) => void;
  /**
   * Whether the row the tree opens at, when the address names none, is a row
   * arrived at; true unless said otherwise. A page that opens at its own top
   * says false: the row says where the reader is and moves nothing.
   */
  readonly followsOpening?: boolean;
}

/**
 * A model tree whose scroller follows the reading position, however it moved:
 * a step of a breadcrumb, the row the tree opened at, a link into the middle
 * of a design, Back or Forward. Watching where the reader is rather than
 * listing the moves that put them there is what makes the last two work —
 * they change the address and tell no one.
 *
 * The exception is a row clicked in the tree: it is already under the
 * reader's eye, and centring it would take the neighbours they were reading
 * out from under them. The note of it is cleared as it is read, so the same
 * row arrived at again — by Forward, say — is scrolled to like any other.
 *
 * `outlineRef` goes on the tree's scroller.
 */
export function useFollowingTree(
  nodes: readonly OutlineNode[],
  state: ModelTreeState,
  { onArrive, followsOpening = true }: Following = {},
): {
  controller: ModelTreeController;
  outlineRef: RefObject<HTMLDivElement | null>;
} {
  const { selected: addressed, onSelect } = state;
  const outlineRef = useRef<HTMLDivElement>(null);
  const picked = useRef<string | null>(null);
  // Noted before the page is told, so that whatever the page does with the
  // move — navigating, rendering — the note is already there to be read.
  const onTreeSelect = useCallback(
    (path: string, source: SelectSource) => {
      if (source === 'tree') picked.current = path;
      onSelect(path, source);
    },
    [onSelect],
  );
  const controller = useModelTree(nodes, { ...state, onSelect: onTreeSelect });
  const at = controller.selected;
  const opening = useRef(!followsOpening && addressed === null ? at : null);
  useEffect(() => {
    const own = picked.current === at;
    picked.current = null;
    if (at === null || at === opening.current) return;
    opening.current = null;
    onArrive?.(at);
    if (!own) revealRow(outlineRef.current, at);
  }, [at, onArrive]);

  return { controller, outlineRef };
}
