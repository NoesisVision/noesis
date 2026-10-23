import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { PageHeading } from '#/shared/ui/page-heading.tsx';
import { useScrolledUnder } from '#/shared/ui/reading-pane.tsx';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DESIGN_DOCS_TONE } from '../design-docs.model.ts';
import classes from './design-doc-surface.module.css';

/*
 * What every view of a design document stands in: the document's name heading
 * the page, the switch beside it, and the window's height
 * below for the columns. One frame for all, mounted once around whichever
 * view is read, so switching views changes what is in it and moves nothing
 * around it.
 */
export function DesignDocSurface({
  document,
  switcher,
  centred = false,
  children,
}: {
  document: DesignDocDetail['document'];
  /** The control that switches to another view, beside the title. */
  switcher?: ReactNode;
  /** The title over the overview's column, as a document's is over its own. */
  centred?: boolean;
  children: ReactNode;
}) {
  // Read as a document is, the overview scrolls the page under its title.
  const stuck = useScrolledUnder();
  return (
    <Box
      component="article"
      className={classes.surface}
      data-centred={centred || undefined}
    >
      <Group
        justify="space-between"
        className={classes.header}
        data-centred={centred || undefined}
        data-stuck={(centred && stuck) || undefined}
      >
        <Box className={classes.title}>
          <PageHeading
            title={document.name}
            tone={DESIGN_DOCS_TONE}
            eyebrow="Design doc"
            meta={document.implemented ? 'Implemented' : 'Draft'}
          />
        </Box>
        <Group gap="sm" wrap="nowrap" className={classes.controls}>
          {switcher}
        </Group>
      </Group>
      {children}
    </Box>
  );
}
