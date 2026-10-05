/**
 * What marks an entry of the document with the row of the tree that brings it
 * into view, and the entry in hand as the reader's place: by `aria-current`
 * for a screen reader, which the stylesheet draws as a rule down its side.
 */
export interface EntryMark {
  'data-entry': string;
  'aria-current'?: 'location';
}

export const entryMark = (path: string, selected: boolean): EntryMark => ({
  'data-entry': path,
  ...(selected ? { 'aria-current': 'location' as const } : {}),
});
