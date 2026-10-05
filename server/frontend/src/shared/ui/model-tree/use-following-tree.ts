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
   * What else follows the reading position: told the row arrived at, once
   * the tree has been asked to show it. Keep it stable.
   *
   * Whatever it scrolls is left the only thing moving: the tree then goes to
   * its row at once, since two smooth scrolls asked for together are not
   * both sure to arrive.
   */
  readonly onArrive?: (path: string) => void;
  /**
   * Whether the row the tree opens at, when the address names none, is a row
   * arrived at; true unless said otherwise. A page that opens at its own top
   * says false: the row says where the reader is and moves nothing — and is
   * kept out of the address, or the next opening would read it there as a row
   * the reader had asked for.
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
 * A row clicked while it is the one in hand moves nothing in the address, so
 * nothing watching it would hear: whatever else follows is told there and
 * then, as a reader who has scrolled away and asks for the row again expects.
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
      if (source === 'init' && !followsOpening) return;
      onSelect(path, source);
    },
    [onSelect, followsOpening],
  );
  const controller = useModelTree(nodes, { ...state, onSelect: onTreeSelect });
  const at = controller.selected;
  // An address naming a row the tree has not got opens it as none does.
  const opening = useRef(!followsOpening && at !== addressed ? at : null);
  useEffect(() => {
    const own = picked.current === at;
    picked.current = null;
    if (at === null || at === opening.current) return;
    opening.current = null;
    // The tree first and at once, so nothing is asked after the follower's
    // own scroll that could cut it short.
    if (!own)
      revealRow(outlineRef.current, at, onArrive ? 'instant' : undefined);
    onArrive?.(at);
  }, [at, onArrive]);

  const { select: selectRow } = controller;
  const select = useCallback(
    (path: string, source: SelectSource) => {
      if (source !== 'tree' || path !== at) return selectRow(path, source);
      onArrive?.(path);
      // The row the tree opened at may be in hand and not yet in the address.
      if (path !== addressed) onSelect(path, source);
    },
    [selectRow, at, addressed, onArrive, onSelect],
  );

  return { controller: { ...controller, select }, outlineRef };
}
