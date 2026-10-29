/**
 * What marks an entry of the document with the row of the tree that brings it
 * into view, and the entry in hand as the reader's place, by `aria-current`.
 * A rule in hand is outlined by it; where the reader is reading is the
 * tree's to show, as a document's Contents does.
 */
export interface EntryMark {
  'data-entry': string;
  'aria-current'?: 'location';
}

export const entryMark = (path: string, selected: boolean): EntryMark => ({
  'data-entry': path,
  ...(selected ? { 'aria-current': 'location' as const } : {}),
});
