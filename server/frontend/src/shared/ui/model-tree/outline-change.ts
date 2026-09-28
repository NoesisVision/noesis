import type { OutlineChange } from './model-outline.ts';

/*
 * One colour for what a design does to an element, wherever it is shown: the
 * badge on a row, the badge over the panel, and the name of the row itself,
 * which `useChangeColour` resolves and hands to `model-tree.module.css` as a
 * variable.
 *
 * The colour is never the only thing said: every one of them sits beside the
 * word it stands for.
 */
export const CHANGE_COLOUR: Record<OutlineChange, string | null> = {
  added: 'green',
  modified: 'cyan',
  removed: 'red',
  unchanged: null,
};
