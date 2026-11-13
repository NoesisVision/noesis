import { type Exploration, groupOf } from './exploration.model.ts';

/*
 * What the reader chose to see: the kinds hidden, and the elements put in
 * or taken out one by one.
 */

/** Elements the reader put in or took out one by one, over the groups shown. */
export interface ElementPicks {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
}

export const NO_PICKS: ElementPicks = { added: new Set(), removed: new Set() };

/** The picks with one element put in or taken out; the latest word on it wins. */
export function picked(
  picks: ElementPicks,
  id: string,
  shown: boolean,
): ElementPicks {
  const added = new Set(picks.added);
  const removed = new Set(picks.removed);
  if (shown) {
    added.add(id);
    removed.delete(id);
  } else {
    removed.add(id);
    added.delete(id);
  }
  return { added, removed };
}

/**
 * What the reader chose to draw: the groups shown — none until they pick
 * some — and the elements put in or taken out one by one over them.
 */
export interface ElementChoice {
  shown: ReadonlySet<string>;
  picks: ElementPicks;
}

export const NOTHING_CHOSEN: ElementChoice = {
  shown: new Set(),
  picks: NO_PICKS,
};

/**
 * The choice kept to what the exploration holds: a group or an element a
 * later scan no longer finds is forgotten, not kept for when it comes back.
 */
export function choiceWithin(
  choice: ElementChoice,
  exploration: Exploration,
): ElementChoice {
  const ids = new Set(exploration.elements.map(({ id }) => id));
  const groups = new Set(exploration.elements.map(groupOf));
  const kept = (names: ReadonlySet<string>, holds: Set<string>) =>
    new Set([...names].filter((name) => holds.has(name)));
  return {
    shown: kept(choice.shown, groups),
    picks: {
      added: kept(choice.picks.added, ids),
      removed: kept(choice.picks.removed, ids),
    },
  };
}

/** The groups a choice hides: every group of the exploration it does not show. */
export function hiddenBy(
  choice: ElementChoice,
  exploration: Exploration,
): ReadonlySet<string> {
  return new Set(
    exploration.elements
      .map(groupOf)
      .filter((group) => !choice.shown.has(group)),
  );
}

/** The picks with several elements put in or taken out at once. */
export const pickedAll = (
  picks: ElementPicks,
  ids: readonly string[],
  shown: boolean,
): ElementPicks => ids.reduce((each, id) => picked(each, id, shown), picks);
