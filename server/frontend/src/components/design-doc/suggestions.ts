import { createExtension, type ExtensionOptions } from '@blocknote/core';
import {
  isSuggestChangesEnabled,
  suggestChanges,
  withSuggestChanges,
} from '@handlewithcare/prosemirror-suggest-changes';
import {
  newSuggestionId,
  SUGGESTION_MARK_EXTENSIONS,
  suggestionAuthorId,
} from '@repo/design-doc-blocks/suggestion-marks';
import type { Node } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';

/*
 * Suggesting mode (plan phase 5), on @handlewithcare/prosemirror-suggest-
 * changes — the library BlockNote's own xl-ai package tracks changes with
 * (decision 56). The suggestion marks live in the shared fragment, so they
 * sync, persist and survive concurrent editing exactly as the text they
 * annotate does; the marks themselves come from @repo/design-doc-blocks so
 * the backend's headless schema registers the identical set.
 */

/**
 * The editor extension: the three suggestion marks, the plugin that carries
 * the enabled flag (local to this client — each person picks their own
 * mode), and the dispatch wrap that turns edits into suggestions while the
 * flag is on. Suggestion ids are `<accountId>:<nonce>`, so authorship rides
 * in the mark.
 */
export const SuggestionsExtension = createExtension(
  ({ editor, options }: ExtensionOptions<{ accountId: string }>) => ({
    key: 'designDocSuggestions',
    tiptapExtensions: SUGGESTION_MARK_EXTENSIONS as unknown as never[],
    prosemirrorPlugins: [suggestChanges()],
    // While suggesting, Enter is inert: the library records a block split as
    // zero-width boundary markers, and rejecting one that starts a block
    // leaves the split behind (verified against 0.1.8). Until that reverts
    // cleanly, structural suggestions are additions via the slash menu and
    // removals via the drag-handle menu, both of which round-trip.
    keyboardShortcuts: {
      Enter: ({ editor: current }) =>
        isSuggestChangesEnabled(current.prosemirrorState),
    },
    mount() {
      // Wrap the view's dispatch: while suggesting is enabled, transactions
      // are transformed into mark-tracked ones before they apply. Remote
      // (y-sync) and undo transactions pass through untouched — the library
      // checks their metas itself.
      const view = editor.prosemirrorView;
      const original = view.props.dispatchTransaction;
      view.setProps({
        dispatchTransaction: withSuggestChanges(original, () =>
          newSuggestionId(options.accountId),
        ),
      });
      return () => {
        // Extension teardown runs after the editor's view is destroyed on a
        // real unmount; setProps on a destroyed view throws.
        if (!view.isDestroyed) {
          view.setProps({ dispatchTransaction: original });
        }
      };
    },
  }),
);

/** DOM selector matching every rendered mark of one suggestion. */
export function suggestionSelector(id: string): string {
  const escaped = CSS.escape(id);
  return `ins[data-id="${escaped}"], del[data-id="${escaped}"], span[data-type="modification"][data-id="${escaped}"]`;
}

/** One pending suggestion, as the rail lists it. */
export interface SuggestionListItem {
  id: string | number;
  /** The account id carried in the suggestion id, null if unknown. */
  authorId: string | null;
  /** Text this suggestion inserts. */
  inserted: string;
  /** Text this suggestion strikes for deletion. */
  deleted: string;
  /** Whether the suggestion (also) changes attributes or formatting. */
  modified: boolean;
  /** Document position of the suggestion's first mark, for sorting. */
  from: number;
  /** The enclosing block (= design-doc element) id, for click-to-jump. */
  blockId: string | null;
}

/**
 * Every pending suggestion in the document, in reading order — scanned from
 * the marks, which are the single source of truth, so the list is identical
 * on every client without any second store to reconcile.
 */
export function collectSuggestions(state: EditorState): SuggestionListItem[] {
  const markTypes = ['insertion', 'deletion', 'modification'] as const;
  const items = new Map<string | number, SuggestionListItem>();
  const containers: { from: number; to: number; id: string }[] = [];

  const item = (id: string | number, pos: number): SuggestionListItem => {
    let existing = items.get(id);
    if (existing === undefined) {
      const container = containers.findLast(
        (candidate) => pos >= candidate.from && pos < candidate.to,
      );
      existing = {
        id,
        authorId: suggestionAuthorId(id),
        inserted: '',
        deleted: '',
        modified: false,
        from: pos,
        blockId: container?.id ?? null,
      };
      items.set(id, existing);
    }
    return existing;
  };

  state.doc.descendants((node: Node, pos: number) => {
    const attrs = node.attrs as { id?: unknown };
    if (node.type.name === 'blockContainer' && typeof attrs.id === 'string') {
      containers.push({ from: pos, to: pos + node.nodeSize, id: attrs.id });
    }
    let blockLevelMark = false;
    for (const mark of node.marks) {
      if (!markTypes.includes(mark.type.name as (typeof markTypes)[number])) {
        continue;
      }
      const id = mark.attrs.id as string | number;
      const entry = item(id, pos);
      const text = node.isText ? (node.text ?? '') : node.textContent;
      if (mark.type.name === 'insertion') entry.inserted += text;
      else if (mark.type.name === 'deletion') entry.deleted += text;
      else entry.modified = true;
      if (!node.isText) blockLevelMark = true;
    }
    // A block-level mark already covers the node's text; don't double count
    // by descending into it.
    return !blockLevelMark;
  });

  return [...items.values()].sort((a, b) => a.from - b.from);
}
