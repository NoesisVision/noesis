import type { ReactNode } from 'react';
import { Group } from '#/shared/design-system/group.tsx';
import { Switch } from '#/shared/design-system/switch.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import type { PlacedElement } from '../../architecture-outline.ts';
import type { TypeRing } from '../../building-block-types.ts';
import { BuildingBlockFilter } from './building-block-filter.tsx';
import classes from './architecture-diagram.module.css';

/** What is drawn over the cards, each for the reader to switch on or off. */
export interface Overlays {
  checks: boolean;
  rules: boolean;
  changes: boolean;
}

const OVERLAYS: { key: keyof Overlays; label: string }[] = [
  { key: 'changes', label: 'Changes' },
  { key: 'checks', label: 'Check markers' },
  { key: 'rules', label: 'Rule counts' },
];

/*
 * What the reader draws the hexagons with: which building blocks, which marks
 * over the cards, and how close. Before the controls, a word on what the
 * diagram cannot draw, on a line of its own when they leave it no room.
 */
export function DiagramToolbar({
  types,
  hiddenTypes,
  onHideTypes,
  overlays,
  onOverlays,
  unplaced,
  children,
}: {
  /** The building block types the hexagons hold, the ones to be left out, and the way to change them. */
  types: TypeRing[];
  hiddenTypes: ReadonlySet<string>;
  onHideTypes: (hidden: ReadonlySet<string>) => void;
  overlays: Overlays;
  onOverlays: (overlays: Overlays) => void;
  /** The elements the hexagons cannot place. */
  unplaced: PlacedElement[];
  /** The zoom controls, last in the row: the canvas they move is the diagram's. */
  children: ReactNode;
}) {
  return (
    // Reversed, so the controls keep the right and the word wraps under them.
    <Group
      flex="none"
      py="sm"
      px="md"
      fz="sm"
      className={`${classes.toolbar} ${classes.toolbarRow}`}
    >
      <Group fz="sm" className={classes.toolbarControls}>
        <BuildingBlockFilter
          rings={types}
          hidden={hiddenTypes}
          onHide={onHideTypes}
        />
        {OVERLAYS.map(({ key, label }) => (
          <Switch
            key={key}
            size="xs"
            label={label}
            checked={overlays[key]}
            onChange={(event) =>
              onOverlays({ ...overlays, [key]: event.currentTarget.checked })
            }
          />
        ))}
        {children}
      </Group>
      {unplaced.length > 0 && (
        <Text fz="xs" flex="1 1 16rem" c="var(--noesis-secondary-text)">
          {`Not drawn, as the design leaves their type as it is: ${unplaced.map(({ name }) => name).join(', ')}.`}
        </Text>
      )}
    </Group>
  );
}
