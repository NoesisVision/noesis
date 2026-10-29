import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Title } from '#/shared/design-system/title.tsx';
import type { PageTone } from '#/shared/ui/icon-heading.tsx';
import classes from './page-heading.module.css';

interface PageHeadingProps {
  /** The view or the item: a nav label, a document's title, a design's name. */
  title: ReactNode;
  /**
   * The kind of page, after a dot in its colour: "Design doc", "Document".
   * None where the title says it already, as the system model's does: the
   * title then stands alone.
   */
  eyebrow?: ReactNode;
  /** What else the line over the title says: a date, a stage, the change. */
  meta?: ReactNode;
  /** The colour of the kind of page, for its dot and its eyebrow. */
  tone?: PageTone;
}

/**
 * The heading of a page: one quiet line saying what kind of page it is and
 * the little else worth knowing at a glance, over the title, which is the
 * page's `h1`. Every page is headed the same way, whatever it shows; one
 * whose title already says what it is goes without the line.
 */
export function PageHeading({ title, eyebrow, meta, tone }: PageHeadingProps) {
  return (
    <Box className={classes.heading} data-page-tone={tone}>
      {eyebrow !== undefined && (
        <Box className={classes.eyebrow}>
          <Box component="span" className={classes.dot} aria-hidden />
          <Box component="span" className={classes.kind}>
            {eyebrow}
          </Box>
          {!!meta && (
            <>
              <Box component="span" aria-hidden>
                ·
              </Box>
              <Box component="span">{meta}</Box>
            </>
          )}
        </Box>
      )}
      <Title order={1} className={classes.title}>
        {title}
      </Title>
    </Box>
  );
}
