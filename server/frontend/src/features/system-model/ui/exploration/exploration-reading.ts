import { createContext, useContext } from 'react';
import type {
  ExploredElement,
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
  /** Takes an element in hand alone, or — adding — into the hand or out of it. */
  onSelect: (id: string, adding: boolean) => void;
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
  ) => void;
  /** Places what a container holds anew, inside it, the rest left standing. */
  onArrange: (id: string) => void;
  /** Takes a container off the diagram and leaves what it holds where it stands. */
  onRemoveAlone: (id: string) => void;
}

export const ExplorationReadingContext = createContext<ExplorationReading>({
  selected: new Set(),
  related: new Set(),
  onSelect: () => {},
  drawn: new Set(),
  neighbours: new Map(),
  elements: new Map(),
  onShow: () => {},
  onArrange: () => {},
  onRemoveAlone: () => {},
});

/** What a card may put on the diagram beside it, or take off it. */
export function useCardActions() {
  const { drawn, neighbours, elements, onShow, onArrange, onRemoveAlone } =
    useContext(ExplorationReadingContext);
  return { drawn, neighbours, elements, onShow, onArrange, onRemoveAlone };
}

/** Where a card stands to the selection: in hand, joined to it, or neither. */
export function useSelectionState(id: string) {
  const { selected, related, onSelect } = useContext(ExplorationReadingContext);
  const state = selected.has(id)
    ? ('selected' as const)
    : related.has(id)
      ? ('related' as const)
      : undefined;
  return { state, onSelect };
}
