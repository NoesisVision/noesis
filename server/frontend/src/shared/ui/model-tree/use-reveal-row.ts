import { type RefObject, useEffect } from 'react';

/**
 * Puts the row the reader has moved to in the middle of the outline, wherever
 * the move was made — a step of the breadcrumb, a link into the middle of a
 * design. `center` and not `nearest`: a row is worth seeing in its
 * surroundings, and a row that merely scraped into view at the bottom edge
 * shows none of what it sits among. The cost is that a row already on screen
 * is moved too. How the scroll is made is the stylesheet's to say, which is
 * how a reader who asked for no motion is given none.
 *
 * What is centred is the label and never the item that holds it: a `treeitem`
 * contains its whole subtree, so a module's is as tall as everything under it
 * and centring that would put the module's own line off the top.
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
          block: 'center',
        });
        return;
      }
    }, 0);
  }, [tree, selected]);
}
