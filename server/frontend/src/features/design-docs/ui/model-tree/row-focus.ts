/*
 * Moving between rows with the keyboard. A collapsed subtree is not rendered
 * at all, so every row in the document is a row the reader can see, and the
 * order they are in is the order to move in — which is why this reads the
 * tree rather than the outline behind it.
 */

function rowsAround(row: HTMLElement): HTMLElement[] {
  const root = row.closest('[role="tree"]');
  return root === null
    ? [row]
    : [...root.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

export function focusSibling(row: HTMLElement, step: number): void {
  const rows = rowsAround(row);
  rows[rows.indexOf(row) + step]?.focus();
}

export function focusEdge(row: HTMLElement, edge: 'first' | 'last'): void {
  const rows = rowsAround(row);
  (edge === 'first' ? rows[0] : rows.at(-1))?.focus();
}

export function focusParent(row: HTMLElement): void {
  row.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus();
}
