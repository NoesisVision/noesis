/** Hands the entry in hand to the card drawn under it. */
export type EntryPin = (entry: HTMLElement | null) => void;

/**
 * What marks an entry of the document with the row of the tree that brings it
 * into view, and the entry in hand as the reader's place: by `aria-current`
 * for a screen reader, and pinned, where it is drawn, for the card that
 * lifts it.
 */
export interface EntryMark {
  'data-entry': string;
  'aria-current'?: 'location';
  ref?: EntryPin;
}

export const entryMark = (
  path: string,
  selected: boolean,
  pin?: EntryPin,
): EntryMark => ({
  'data-entry': path,
  ...(selected ? { 'aria-current': 'location' as const, ref: pin } : {}),
});
