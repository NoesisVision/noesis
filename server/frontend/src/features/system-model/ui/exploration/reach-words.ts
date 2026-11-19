import { type Reach } from '../../system-model-exploration.ts';

/*
 * What a card's menu calls each way it reaches others.
 */

/** What the round button says it brings, of how many. */
export const containsLabel = (name: string, count: number) =>
  `Show ${count === 1 ? 'the element' : `the ${count} elements`} ${name} contains`;

/** A kind as a menu names it in a few letters: "block", "module". */
const shortKindOf = (kind: string) =>
  kind === 'building_block' ? 'block' : kind.replaceAll('_', ' ');

/** What setting everything out again says, on the toolbar. */
export const REORDER_DIAGRAM = 'Reorder diagram';

/** What setting out again what a frame holds says, in its menu: "Reorder module". */
export const reorderLabel = (frame: { kind: string }) =>
  `Reorder ${shortKindOf(frame.kind)}`;

/** What the way to a card's parent says, in its menu and beside its cross: "Show parent block". */
export const showParentLabel = (parent: { kind: string }) =>
  `Show parent ${shortKindOf(parent.kind)}`;

/** What the card's own menu calls each way, under its "Add" heading. */
export const REACH_ACTION = {
  contains: 'Contains',
  isPartOf: 'Part of',
  hasState: 'Has state',
  stateOf: 'State of',
  hasInput: 'Has input',
  inputOf: 'Input of',
  hasOutput: 'Has output',
  outputOf: 'Output of',
  extends: 'Extends',
  extendedBy: 'Extended by',
  worksWith: 'Works with',
  collaboratorOf: 'Collaborator of',
  invokes: 'Invokes',
  invokedBy: 'Invoked by',
  performs: 'Performs',
  performedBy: 'Performed by',
  ships: 'Ships',
  shippedIn: 'Shipped in',
  provides: 'Provides',
  providedBy: 'Provided by',
  places: 'Places',
  placedIn: 'Placed in',
  runs: 'Runs',
  runsOn: 'Runs on',
} as const satisfies Record<Reach, string>;
