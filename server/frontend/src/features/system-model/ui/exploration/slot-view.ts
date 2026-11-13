/*
 * How a badge's popup walks what its type relates to: in columns, as a
 * tree, drilling in one type at a time, or as cards nested in cards. The
 * reader's choice is kept for the session, so the next popup, from any
 * card, opens the same way.
 */

export const SLOT_VIEWS = ['columns', 'tree', 'drill', 'nested'] as const;
export type SlotView = (typeof SLOT_VIEWS)[number];

const KEY = 'noesis.systemModel.exploration.slotView';
const isView = (value: unknown): value is SlotView =>
  SLOT_VIEWS.some((view) => view === value);

/** The view last chosen this session; columns before any is. */
export function recallSlotView(): SlotView {
  try {
    const kept = window.sessionStorage.getItem(KEY);
    return isView(kept) ? kept : 'columns';
  } catch {
    // Storage unavailable: the popup opens in columns.
    return 'columns';
  }
}

export function rememberSlotView(view: SlotView): void {
  try {
    window.sessionStorage.setItem(KEY, view);
  } catch {
    // Storage unavailable: the choice holds for this popup alone.
  }
}
