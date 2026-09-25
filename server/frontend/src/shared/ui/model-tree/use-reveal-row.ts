import { type RefObject, useEffect } from 'react';

/**
 * Brings the row the reader has moved to into view, wherever the move was
 * made — a step of the breadcrumb, a link into the middle of a design.
 * `nearest` means a row already on screen is left where it is, and how the
 * scroll is made is the stylesheet's to say, which is how a reader who asked
 * for no motion is given none.
 *
 * What is brought into view is the label and never the item that holds it: a
 * `treeitem` contains its whole subtree, so a module's is as tall as
 * everything under it and already covers the scroller — `nearest` would
 * rightly decide there was nothing to do and the reader would be taken
 * nowhere.
 */
export function useRevealRow(
  tree: RefObject<HTMLElement | null>,
  selected: string | null,
): void {
  useEffect(() => {
    if (selected === null) return;
    // Asked during the effect itself the view stays where it was; asked a
    // tick later, once the rows are laid out, it arrives.
    setTimeout(() => {
      const items = tree.current?.querySelectorAll<HTMLElement>('[data-path]');
      for (const item of items ?? []) {
        if (item.dataset.path !== selected) continue;
        item.querySelector<HTMLElement>(':scope > [data-row]')?.scrollIntoView({
          block: 'nearest',
        });
        return;
      }
    }, 0);
  }, [tree, selected]);
}
