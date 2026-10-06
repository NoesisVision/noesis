import type { OutlineChange } from './model-outline.ts';

/*
 * One colour for what a design does to an element, wherever it is shown: the
 * mark on a row's icon and the badge over the panel, both resolved by
 * `useChangeColour`.
 *
 * The colour is never the only thing said: the mark's shape and the badge's
 * word say it as well.
 */
export const CHANGE_COLOUR: Record<OutlineChange, string | null> = {
  added: 'green',
  modified: 'cyan',
  removed: 'red',
  unchanged: null,
};
