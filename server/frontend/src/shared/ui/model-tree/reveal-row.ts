/**
 * Puts a row in the middle of the outline. `center` and not `nearest`: a row
 * is worth seeing in its surroundings, and a row that merely scraped into view
 * at the bottom edge shows none of what it sits among. The cost is that a row
 * already on screen is moved too, which is why this is asked for a move the
 * reader made elsewhere and never for a row they clicked. How the scroll is
 * made is the stylesheet's to say, which is how a reader who asked for no
 * motion is given none.
 *
 * What is centred is the label and never the item that holds it: a `treeitem`
 * contains its whole subtree, so a module's is as tall as everything under it
 * and centring that would put the module's own line off the top.
 */
export function revealRow(within: HTMLElement | null, path: string): void {
  // Asked in the same tick as the move the view stays where it was; asked a
  // tick later, once the rows are laid out, it arrives.
  setTimeout(() => {
    const items = within?.querySelectorAll<HTMLElement>('[data-path]');
    for (const item of items ?? []) {
      if (item.dataset.path !== path) continue;
      item.querySelector<HTMLElement>(':scope > [data-row]')?.scrollIntoView({
        block: 'center',
      });
      return;
    }
  }, 0);
}
