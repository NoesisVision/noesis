import {
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconZoomScan,
} from '@tabler/icons-react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import classes from './zoom-controls.module.css';

const ICON_SIZE = { md: 16, lg: 20 } as const;
/** Snug beside a small canvas's buttons; the theme's step beside a large one's. */
const GAP = { md: 4, lg: 'xs' } as const;

/**
 * The buttons a canvas is zoomed with, the same wherever one is drawn: out,
 * how far in it is, in, and fit. The canvas does the zooming; this only asks
 * for it and says where it stands.
 */
export function ZoomControls({
  zoom,
  onZoomOut,
  onZoomIn,
  onFit,
  onActualSize,
  size = 'md',
  disabled = false,
}: {
  /** The scale the canvas is at; 1 is the size it was drawn. */
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  /** For a canvas whose picture has a size of its own to go back to. */
  onActualSize?: () => void;
  size?: keyof typeof ICON_SIZE;
  /** While the canvas is not there to be zoomed yet. */
  disabled?: boolean;
}) {
  const button = { variant: 'default', size, disabled } as const;
  const icon = { size: ICON_SIZE[size], stroke: 1.6, 'aria-hidden': true };
  return (
    // A fieldset by its legend, laid out as a group, with nothing a fieldset
    // draws of its own: Group takes no `component`, so it is given the tag.
    <Group
      renderRoot={(props) => <fieldset {...props} />}
      gap={GAP[size]}
      wrap="nowrap"
      m={0}
      p={0}
      bd={0}
      miw={0}
      data-size={size}
    >
      <VisuallyHidden component="legend">Zoom</VisuallyHidden>
      <ActionIcon
        {...button}
        aria-label="Zoom out"
        title="Zoom out"
        onClick={onZoomOut}
      >
        <IconZoomOut {...icon} />
      </ActionIcon>
      <Text
        component="output"
        size={size === 'lg' ? 'sm' : 'xs'}
        className={classes.level}
      >
        {`${Math.round(zoom * 100)}%`}
      </Text>
      <ActionIcon
        {...button}
        aria-label="Zoom in"
        title="Zoom in"
        onClick={onZoomIn}
      >
        <IconZoomIn {...icon} />
      </ActionIcon>
      <ActionIcon
        {...button}
        aria-label="Fit to view"
        title="Fit to view"
        onClick={onFit}
      >
        <IconZoomScan {...icon} />
      </ActionIcon>
      {onActualSize !== undefined && (
        <ActionIcon
          {...button}
          aria-label="Actual size"
          title="Actual size"
          onClick={onActualSize}
        >
          <IconZoomReset {...icon} />
        </ActionIcon>
      )}
    </Group>
  );
}
