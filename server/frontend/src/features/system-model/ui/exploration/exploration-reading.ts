import { createContext, useContext } from 'react';
import type {
  Badge,
  DrawnRelationKind,
  ExploredElement,
  ModelSlots,
  Neighbours,
} from '../../system-model-exploration.ts';
import type { CanvasPoint } from './place-locally.ts';

/*
 * What a card shows of the selection, and what it can put on the diagram.
 * A node holds only where its card stands, so selecting one does not hand
 * React Flow every node anew to measure; the rest reaches the cards through
 * context instead.
 */
export interface ExplorationReading {
  /** Every element in hand; more than one when picked with Ctrl or Cmd. */
  selected: ReadonlySet<string>;
  /** The elements a relation drawn from or to the selection joins it to. */
  related: ReadonlySet<string>;
  /** The frames the selection is drawn inside, out to the outermost: the way to it. */
  path: ReadonlySet<string>;
  /** Each card's slots, drawn on it. */
  badges: ReadonlyMap<string, readonly Badge[]>;
  /** The behaviors drawn that give nothing back, which their signatures say. */
  noOutput: ReadonlySet<string>;
  /** Every slot of the model, for a badge to walk from its type on. */
  slots: ModelSlots;
  /** Takes a card already drawn in hand alone and brings it into sight. */
  onGoTo: (id: string) => void;
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
}

export const ExplorationReadingContext = createContext<ExplorationReading>({
  selected: new Set(),
  related: new Set(),
  path: new Set(),
  badges: new Map(),
  noOutput: new Set(),
  slots: { of: new Map(), behaviors: new Map() },
  onGoTo: () => {},
  onSelect: () => {},
  onLetGo: () => {},
  drawn: new Set(),
  neighbours: new Map(),
  elements: new Map(),
  onShow: () => {},
  onDraw: () => {},
  onArrange: () => {},
});

/** What a card may put on the diagram beside it, or take off it. */
export function useCardActions() {
  const { drawn, neighbours, elements, onShow, onDraw, onArrange } = useContext(
    ExplorationReadingContext,
  );
  return {
    drawn,
    neighbours,
    elements,
    onShow,
    onDraw,
    onArrange,
  };
}

/**
 * Where a card stands to the selection: in hand, joined to it, a frame on
 * the way to it, or none of these.
 */
export function useSelectionState(id: string) {
  const { selected, related, path, onSelect, onLetGo } = useContext(
    ExplorationReadingContext,
  );
  // A frame the selection is drawn in reads as the way to it, though what
  // holds an element is also a relation of it.
  const state = selected.has(id)
    ? ('selected' as const)
    : path.has(id)
      ? ('path' as const)
      : related.has(id)
        ? ('related' as const)
        : undefined;
  // With something in hand, what has nothing to do with it steps back.
  const dimmed = selected.size > 0 && state === undefined;
  return { state, dimmed, onSelect, onLetGo };
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
