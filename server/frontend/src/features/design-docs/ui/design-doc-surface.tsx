import type { ReactNode } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
import { FullscreenButton } from '#/shared/ui/shell-fullscreen.tsx';
import type { DesignDocDetail } from '../design-docs.api.ts';
import { DesignDocsIcon } from '../design-docs.model.ts';
import classes from './design-doc-surface.module.css';

/*
 * What every view of a design document stands in: the document's name heading
 * the page, the switch and full screen beside it, and the window's height
 * below for the columns. One frame for all, mounted once around whichever
 * view is read, so switching views changes what is in it and moves nothing
 * around it.
 */
export function DesignDocSurface({
  document,
  switcher,
  children,
}: {
  document: DesignDocDetail['document'];
  /** The control that switches to another view, beside full screen. */
  switcher?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="article" className={classes.surface}>
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <IconHeading
          title={document.name}
          icon={DesignDocsIcon}
          description={document.implemented ? 'Implemented' : 'Draft'}
        />
        <Group gap="sm" wrap="nowrap">
          {switcher}
          <FullscreenButton />
        </Group>
      </Group>
      {children}
    </Box>
  );
}
