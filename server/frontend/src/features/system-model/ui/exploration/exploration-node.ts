import { type Node } from '@xyflow/react';
import type { PlacedElement } from './layout-exploration.ts';

/*
 * A card of the exploration as React Flow holds it.
 */

export type ExplorationNode = Node<{
  placed: PlacedElement;
  /** Taken off the diagram, and drawn a moment longer to leave it. */
  leaving?: boolean;
}>;
