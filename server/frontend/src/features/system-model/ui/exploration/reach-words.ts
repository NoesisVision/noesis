import { type Reach } from '../../system-model-exploration.ts';

/*
 * What a card's menu calls each way it reaches others.
 */

/** What the round button says it brings, of how many. */
export const containsLabel = (name: string, count: number) =>
  `Show ${count === 1 ? 'the element' : `the ${count} elements`} ${name} contains`;

/** What the way to tidy up a frame says, in its corner and in its menu. */
export const TIDY_UP = 'Tidy up inside';

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
