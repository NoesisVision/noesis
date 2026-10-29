import { type RefObject, useEffect } from 'react';
import {
  type DocumentHeading,
  headingOfFragment,
} from '../document-outline.ts';
import { headingIn } from './use-current-section.ts';

/** How long a heading named on opening is waited for, while the editor loads. */
const OPENING_WAIT_MS = 3000;

/**
 * A link in the document to one of its own headings (`[glossary](#glossary)`)
 * takes the reader there, as Contents does: the editor draws headings with no
 * id for the browser to scroll to. So does the page opened, or gone back to,
 * at such an address — once the editor has drawn the heading.
 */
export function useHeadingLinks(
  body: RefObject<HTMLElement | null>,
  headings: DocumentHeading[],
) {
  useEffect(() => {
    const root = body.current;
    if (root === null || headings.length === 0) return;
    const headingAt = (fragment: string) => {
      const index = headingOfFragment(headings, decodeURIComponent(fragment));
      return index === null ? undefined : headingIn(root, headings, index);
    };
    const goTo = (fragment: string, behavior: ScrollBehavior) => {
      const heading = headingAt(fragment);
      heading?.scrollIntoView({ behavior, block: 'start' });
      return heading !== undefined;
    };

    // A click on such a link: the address takes its fragment as ever, and
    // the page goes to the heading.
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      const fragment = link?.getAttribute('href');
      if (fragment == null || fragment === '#') return;
      if (headingAt(fragment) === undefined) return;
      requestAnimationFrame(() => goTo(fragment, 'smooth'));
    };
    root.addEventListener('click', onClick);

    // Back or forward to such an address.
    const onHashChange = () => {
      if (window.location.hash !== '') goTo(window.location.hash, 'smooth');
    };
    window.addEventListener('hashchange', onHashChange);

    // Opened at such an address: as soon as the heading is drawn.
    let frame = 0;
    const opened = performance.now();
    const fragment = window.location.hash;
    const arrive = () => {
      frame = 0;
      if (goTo(fragment, 'auto')) return;
      if (performance.now() - opened < OPENING_WAIT_MS)
        frame = requestAnimationFrame(arrive);
    };
    if (fragment !== '') arrive();

    return () => {
      root.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHashChange);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [body, headings]);
}
