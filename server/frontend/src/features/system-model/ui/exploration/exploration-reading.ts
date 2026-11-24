import { createContext, useContext, useMemo } from 'react';
import { createStore, type Store, useStoreValue } from '#/shared/store.ts';
import type {
  Badge,
  DrawnRelationKind,
  ExploredElement,
  ModelSlots,
  Neighbours,
  SlotGroup,
  SlotsHidden,
  SteppingBack,
} from '../../system-model-exploration.ts';
import type { CanvasPoint } from './place-locally.ts';

/*
 * What a card reads of the diagram, and what it can put on it. A node
 * holds only where its card stands, so selecting one does not hand React
 * Flow every node anew to measure; the rest reaches the cards from here.
 *
 * What the cards all read alike — the slots, what is drawn, the ways to
 * change it — comes through context, and changes only as the diagram does.
 * The selection changes with every click, and to each card differently, so
 * it is held in a store, where a card reads only where it stands itself
 * and is drawn again only when that changes.
 */

/** The selection, as the cards read it. */
export interface SelectionReading {
  /** Every element in hand; more than one when picked with Ctrl or Cmd. */
  selected: ReadonlySet<string>;
  /** The elements a relation drawn from or to the selection joins it to. */
  related: ReadonlySet<string>;
  /** The frames the selection is drawn inside, out to the outermost: the way to it. */
  path: ReadonlySet<string>;
}

const NO_SELECTION: SelectionReading = {
  selected: new Set(),
  related: new Set(),
  path: new Set(),
};

/** The selection the cards under it stand to; nothing in hand, until given one. */
export const ExplorationSelectionContext = createContext<
  Store<SelectionReading>
>(createStore(NO_SELECTION));

export interface ExplorationReading {
  /** Each card's slots, drawn on it. */
  badges: ReadonlyMap<string, readonly Badge[]>;
  /** The behaviors drawn that give nothing back, which their signatures say. */
  noOutput: ReadonlySet<string>;
  /**
   * From how far off each card steps back, and each frame holds only
   * what has. The same whatever the zoom: the page goes by
   * them as the zoom changes, and no card is drawn again for it.
   */
  stepping: SteppingBack;
  /** Every slot of the model, for a badge to walk from its type on. */
  slots: ModelSlots;
  /** Takes a card already drawn in hand alone and brings it into sight. */
  onGoTo: (id: string) => void;
  /**
   * From further off, puts a card in the middle of the canvas and brings
   * it closer, and says it did; close up it does nothing, and says so.
   */
  onInto: (id: string) => boolean;
  /** Takes an element in hand alone, or — adding — into the hand or out of it. */
  onSelect: (id: string, adding: boolean) => void;
  /** Lets go of everything in hand, as a click on the empty canvas does. */
  onLetGo: () => void;
  /** Whether each element is drawn, and whom the model joins it to. */
  drawn: ReadonlySet<string>;
  neighbours: ReadonlyMap<string, Neighbours>;
  /** Every element of the model, by id, so a card can name the others. */
  elements: ReadonlyMap<string, ExploredElement>;
  /**
   * Puts elements on the diagram beside a card, or takes them off it; put
   * inside it, they are then arranged there.
   */
  onShow: (
    ids: readonly string[],
    shown: boolean,
    from: string,
    arrange?: boolean,
    /** Where on the canvas they were asked for, to stand round, if anywhere. */
    at?: CanvasPoint,
    /** Brought in by following a slot from the card: its badges, not cards. */
    bySlot?: boolean,
  ) => void;
  /** Draws a relation's edges, if they are not drawn already. */
  onDraw: (relation: DrawnRelationKind) => void;
  /** Places what a container holds anew, inside it, the rest left standing. */
  onArrange: (id: string) => void;
  /** The groups of slots each card carries, shown or hidden: what its menu offers. */
  slotGroups: ReadonlyMap<string, readonly SlotGroup[]>;
  /** The cards whose slots of each group the reader hid. */
  slotsHidden: SlotsHidden;
  /** Shows a group of a card's slots on it again, or hides it. */
  onToggleSlots: (id: string, group: SlotGroup) => void;
}

export const ExplorationReadingContext = createContext<ExplorationReading>({
  badges: new Map(),
  noOutput: new Set(),
  stepping: { steppedBackFrom: new Map(), hollowFrom: new Map() },
  slots: { of: new Map(), behaviors: new Map() },
  onGoTo: () => {},
  onInto: () => false,
  onSelect: () => {},
  onLetGo: () => {},
  drawn: new Set(),
  neighbours: new Map(),
  elements: new Map(),
  onShow: () => {},
  onDraw: () => {},
  onArrange: () => {},
  slotGroups: new Map(),
  slotsHidden: { state: new Set(), signature: new Set() },
  onToggleSlots: () => {},
});

/** What a card may put on the diagram beside it, or take off it. */
export function useCardActions() {
  const {
    drawn,
    neighbours,
    elements,
    onShow,
    onDraw,
    onArrange,
    slotGroups,
    slotsHidden,
    onToggleSlots,
  } = useContext(ExplorationReadingContext);
  return {
    drawn,
    neighbours,
    elements,
    onShow,
    onDraw,
    onArrange,
    slotGroups,
    slotsHidden,
    onToggleSlots,
  };
}

/** Where one element stands to the selection, as one word, if anywhere. */
const standingOf = (
  { selected, related, path }: SelectionReading,
  id: string,
): 'selected' | 'path' | 'related' | undefined => {
  if (selected.has(id)) return 'selected';
  // A frame the selection is drawn in reads as the way to it, though what
  // holds an element is also a relation of it.
  if (path.has(id)) return 'path';
  return related.has(id) ? 'related' : undefined;
};

/**
 * Where a card stands to the selection: in hand, joined to it, a frame on
 * the way to it, or none of these. Read for this card alone, so it is
 * drawn again only when where it stands changes. That what has nothing to
 * do with the selection steps back is the page's to draw, from the mark on
 * the whole diagram that something is in hand (exploration.module.css):
 * taking a card in hand then draws again only the cards it has to do with.
 */
export function useSelectionState(id: string) {
  const selection = useContext(ExplorationSelectionContext);
  const { onSelect, onLetGo } = useContext(ExplorationReadingContext);
  const state = useStoreValue(selection, (now) => standingOf(now, id));
  return { state, onSelect, onLetGo };
}

/** Which of these elements are in hand: the same set until that changes. */
export function useSelectedAmong(ids: readonly string[]): ReadonlySet<string> {
  const selection = useContext(ExplorationSelectionContext);
  const held = useStoreValue(selection, ({ selected }) =>
    selected.size === 0 ? '' : ids.filter((id) => selected.has(id)).join('\n'),
  );
  return useMemo(() => new Set(held === '' ? [] : held.split('\n')), [held]);
}

/** The frames each element in `ids` is drawn inside, out to the outermost. */
export function pathTo(
  ids: ReadonlySet<string>,
  elements: ReadonlyMap<string, ExploredElement>,
): ReadonlySet<string> {
  const path = new Set<string>();
  for (const id of ids) {
    let parent = elements.get(id)?.container ?? null;
    while (parent !== null && !path.has(parent)) {
      path.add(parent);
      parent = elements.get(parent)?.container ?? null;
    }
  }
  return path;
}
