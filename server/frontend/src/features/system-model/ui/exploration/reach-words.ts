import { type Reach } from '../../system-model-exploration.ts';

/*
 * What a card's menu calls each way it reaches others.
 */

/** What the round button says it brings, of how many. */
export const containsLabel = (name: string, count: number) =>
  `Show ${count === 1 ? 'the element' : `the ${count} elements`} ${name} contains`;

/** What the way to set out again what a frame holds says, in its menu: the toolbar's word for the whole diagram. */
export const AUTO_PLACE = 'Auto-place';

/** What the way to a card's parent says, in its menu and beside its cross: "Show parent block". */
export const showParentLabel = (parent: { kind: string }) =>
  `Show parent ${parent.kind === 'building_block' ? 'block' : parent.kind.replaceAll('_', ' ')}`;

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
