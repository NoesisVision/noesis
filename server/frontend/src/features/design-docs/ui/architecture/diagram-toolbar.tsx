import { IconStack2 } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import {
  CanvasToolbar,
  ToolbarDivider,
  ToolbarOptions,
} from '#/shared/ui/canvas-toolbar.tsx';
import type { PlacedElement } from '../../architecture-outline.ts';
import type { TypeRing } from '../../building-block-types.ts';
import { BuildingBlockFilter } from './building-block-filter.tsx';

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
 * What the reader draws the hexagons with, as the exploration's toolbar is
 * laid out: which building blocks, then which marks over the cards, and at
 * the far end how close. Under them, a word on what the diagram cannot draw.
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
  /** The zoom controls, at the row's far end: the canvas they move is the diagram's. */
  children: ReactNode;
}) {
  return (
    <CanvasToolbar
      end={children}
      note={
        unplaced.length > 0
          ? `Not drawn, as the design leaves their type as it is: ${unplaced.map(({ name }) => name).join(', ')}.`
          : undefined
      }
    >
      <BuildingBlockFilter
        rings={types}
        hidden={hiddenTypes}
        onHide={onHideTypes}
      />
      <ToolbarDivider />
      <ToolbarOptions
        label="Marks"
        icon={IconStack2}
        title="What is drawn over the cards"
        options={OVERLAYS.map(({ key, label }) => ({
          label,
          checked: overlays[key],
          onChange: (checked) => onOverlays({ ...overlays, [key]: checked }),
        }))}
      />
    </CanvasToolbar>
  );
}
