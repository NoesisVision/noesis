import { type ReactNode, useEffect, useState } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import type { PageTone } from '#/shared/ui/icon-heading.tsx';
import { PageHeading } from '#/shared/ui/page-heading.tsx';
import classes from './reading-pane.module.css';

interface ReadingPaneProps {
  /** The item the page is about: a document's title, a design's name. */
  title: ReactNode;
  /** What else is worth a glance, beside the kind over the title: a date. */
  meta?: ReactNode;
  /** The colour of the kind of page, for its heading. */
  tone?: PageTone;
  /** The kind of page, over its title. */
  eyebrow: ReactNode;
  /** The document itself, laid out under the heading. */
  children: ReactNode;
}

/**
 * Whether the document has moved under the header, so it can draw the edge
 * that says the page carries on beneath it.
 *
 * The header rests at the very offset it sticks to, so where it sits says
 * nothing about whether it is holding anything back; what the reader has
 * scrolled does. Either scroller counts — the shell's content in full screen,
 * the page's otherwise — and a scroll event does not bubble but is seen on the
 * way down, so one capturing listener hears whichever of the two it was.
 */
export function useScrolledUnder(): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () =>
      setScrolled(
        Math.max(
          document.scrollingElement?.scrollTop ?? 0,
          document.fullscreenElement?.scrollTop ?? 0,
        ) > 0,
      );

    read();
    document.addEventListener('scroll', read, { capture: true, passive: true });
    // Leaving full screen hands the scrolling back to the page.
    document.addEventListener('fullscreenchange', read);
    return () => {
      document.removeEventListener('scroll', read, { capture: true });
      document.removeEventListener('fullscreenchange', read);
    };
  }, []);

  return scrolled;
}

/**
 * The surface a whole document is read on: its heading over it, stuck under
 * the top bar as the document scrolls, both at the width the design's
 * overview is read at.
 */
export function ReadingPane({
  title,
  meta,
  tone,
  eyebrow,
  children,
}: ReadingPaneProps) {
  const stuck = useScrolledUnder();

  return (
    <Box component="article" className={classes.surface}>
      <Box className={classes.header} data-stuck={stuck || undefined}>
        <Box className={classes.headerColumn}>
          <PageHeading
            title={title}
            eyebrow={eyebrow}
            meta={meta}
            tone={tone}
          />
        </Box>
      </Box>
      <Box className={classes.column}>{children}</Box>
    </Box>
  );
}
