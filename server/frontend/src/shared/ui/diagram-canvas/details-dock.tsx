import { IconListDetails } from '@tabler/icons-react';
import { Panel } from '@xyflow/react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import classes from './details-dock.module.css';

/*
 * Where a canvas reads its selection: the details panel over its top right
 * and, in that corner, the button the panel is minimized into. Both are
 * always there, so each grows or shrinks into the other; the one out of
 * sight is `inert`. Its own scroll and clicks: a wheel over it reads on
 * rather than zooms.
 *
 * Render it inside the canvas's `ReactFlow`, and give the panel in it an
 * `onMinimize` that folds the dock.
 */
export function DetailsDock({
  folded,
  onUnfold,
  subject,
  children,
}: {
  folded: boolean;
  onUnfold: () => void;
  /** The name of what is read in it, for the button that opens it again. */
  subject: string;
  children: ReactNode;
}) {
  const unfold = `Show the details of ${subject}`;
  return (
    <Panel
      position="top-right"
      className={`nowheel nopan ${classes.dock}`}
      data-folded={folded || undefined}
    >
      <section aria-label="Selection" className={classes.panel} inert={folded}>
        {children}
      </section>
      <Tooltip label={unfold} position="left">
        <ActionIcon
          variant="default"
          size={44}
          className={classes.button}
          aria-label={unfold}
          aria-expanded={false}
          inert={!folded}
          onClick={onUnfold}
        >
          <IconListDetails size={20} stroke={1.7} aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Panel>
  );
}
