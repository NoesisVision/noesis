import { type RefObject, useEffect, useState } from 'react';
import type { DocumentHeading } from '../document-outline.ts';

/**
 * How far below the top of the window a heading has to rise to be the section
 * read: where a heading scrolled to from Contents comes to rest, under the
 * page's sticky title (the prose's `scroll-margin-top`), and a little more.
 */
const READ_LINE = 9 * 16 + 8;

/**
 * The heading on the page a Contents row stands for: the one with its words,
 * counting from the top past any earlier heading with the same words.
 */
export function headingIn(
  root: HTMLElement | null,
  headings: DocumentHeading[],
  index: number,
): HTMLElement | undefined {
  const heading = headings[index];
  if (root === null || heading === undefined) return undefined;
  const before = headings
    .slice(0, index)
    .filter(({ text }) => text === heading.text).length;
  return [
    ...root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
  ].filter((element) => element.textContent?.trim() === heading.text)[before];
}

/**
 * Which section of the document is being read: the last heading to have risen
 * past the read line; at the very end of the page, the last heading on
 * screen, since the last sections may be too short to ever reach the line.
 * Before any has risen that far, the first: it is where the reading starts.
 *
 * Read again on every scroll — the page's, or the shell's content in full
 * screen; a scroll event does not bubble but is seen on the way down — and
 * whenever the document changes size, as when its editor has loaded.
 */
export function useCurrentSection(
  body: RefObject<HTMLElement | null>,
  headings: DocumentHeading[],
): number | null {
  const [current, setCurrent] = useState<number | null>(
    headings.length > 0 ? 0 : null,
  );

  useEffect(() => {
    const root = body.current;
    if (root === null || headings.length === 0) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const tops = headings.map(
        (_, index) =>
          headingIn(root, headings, index)?.getBoundingClientRect().top,
      );
      const scroller =
        document.fullscreenElement ?? document.scrollingElement ?? null;
      const atEnd =
        scroller !== null &&
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 2;
      const line = atEnd ? window.innerHeight : READ_LINE;
      let found = 0;
      tops.forEach((top, index) => {
        if (top !== undefined && top <= line) found = index;
      });
      setCurrent(found);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    read();
    document.addEventListener('scroll', schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [body, headings]);

  return current;
}
