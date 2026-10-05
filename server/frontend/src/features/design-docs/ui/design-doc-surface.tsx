import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { useFullscreenElement } from '#/shared/design-system/hooks.ts';
import { IconHeading } from '#/shared/ui/icon-heading.tsx';
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
  const { ref, toggle, fullscreen } = useFullscreenElement<HTMLDivElement>();
  const fullscreenLabel = fullscreen ? 'Exit full screen' : 'Full screen';
  // A browser that refuses leaves the pane as it is, which is what the button
  // already shows, so there is nothing to report.
  const toggleFullscreen = () => void toggle().catch(() => {});

  return (
    <Box component="article" ref={ref} className={classes.surface}>
      <Group justify="space-between" wrap="nowrap" className={classes.header}>
        <IconHeading
          title={document.name}
          icon={DesignDocsIcon}
          description={document.implemented ? 'Implemented' : 'Draft'}
        />
        <Group gap="sm" wrap="nowrap">
          {switcher}
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={fullscreenLabel}
            title={fullscreenLabel}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <IconMinimize size={22} stroke={1.6} aria-hidden />
            ) : (
              <IconMaximize size={22} stroke={1.6} aria-hidden />
            )}
          </ActionIcon>
        </Group>
      </Group>
      {children}
    </Box>
  );
}
