import { type RefObject, useEffect } from 'react';

/** How far under the pane's top edge an entry still counts as at the top. */
const SLACK = 24;

/**
 * Marks, in the tree, the row of the entry at the top of the document as it
 * is scrolled: the place the reader has reached, one row at a time. An entry
 * is the last whose top has reached the pane's — a rule before the need it
 * stands under, which starts above it. A row the tree has folded away gives
 * the mark to the entry around it. The mark is a `data-spied` on the row,
 * drawn as the pointer's hover is; it is the reader's place, not their pick,
 * so it never moves the tree or the selection.
 */
export function useScrollSpy(
  page: RefObject<HTMLElement | null>,
  outline: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const scroller = scrollingAncestor(page.current);
    if (scroller === null) return;
    let frame = 0;
    const spy = () => {
      frame = 0;
      const tree = outline.current;
      if (page.current === null || tree === null) return;
      const top = scroller.getBoundingClientRect().top + SLACK;
      let at: HTMLElement | null = null;
      for (const entry of page.current.querySelectorAll<HTMLElement>(
        '[data-entry]',
      )) {
        if (entry.getBoundingClientRect().top > top) break;
        at = entry;
      }
      at ??= page.current.querySelector<HTMLElement>('[data-entry]');
      let row: Element | null = null;
      for (
        let entry = at;
        entry !== null && row === null;
        entry =
          entry.parentElement?.closest<HTMLElement>('[data-entry]') ?? null
      )
        row = tree.querySelector(
          `[data-path="${CSS.escape(entry.dataset.entry ?? '')}"]`,
        );
      for (const spied of tree.querySelectorAll('[data-spied]'))
        if (spied !== row) spied.removeAttribute('data-spied');
      row?.setAttribute('data-spied', '');
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(spy);
    };
    spy();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [page, outline]);
}

/** The box that scrolls the element: the nearest ancestor that overflows by scrolling. */
function scrollingAncestor(element: HTMLElement | null): HTMLElement | null {
  for (let at = element?.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if (overflowY === 'auto' || overflowY === 'scroll') return at;
  }
  return null;
}
