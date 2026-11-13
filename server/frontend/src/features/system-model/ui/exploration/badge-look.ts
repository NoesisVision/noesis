import type { BadgeLook } from '../../system-model-exploration.ts';

/*
 * How the badges on the cards are drawn, chosen in the toolbar while the
 * looks are being tried. Kept in this browser, across reloads, apart from
 * the diagram's steps: going back a step does not change it.
 */

const BADGE_LOOKS = [
  'labels',
  'signature',
  'chips',
] as const satisfies readonly BadgeLook[];

const KEY = 'noesis.systemModel.exploration.badgeLook';
const isLook = (value: unknown): value is BadgeLook =>
  BADGE_LOOKS.some((look) => look === value);

/** The look last chosen; labels before any is. */
export function recallBadgeLook(): BadgeLook {
  try {
    const kept = window.localStorage.getItem(KEY);
    return isLook(kept) ? kept : 'labels';
  } catch {
    // Storage unavailable: the badges are drawn under their labels.
    return 'labels';
  }
}

export function rememberBadgeLook(look: BadgeLook): void {
  try {
    window.localStorage.setItem(KEY, look);
  } catch {
    // Storage unavailable: the look holds until the page is left.
  }
}
