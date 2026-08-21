import { CommentsExtension } from '@blocknote/core/comments';
import { useEditorChange, useExtensionState } from '@blocknote/react';
import {
  disableSuggestChanges,
  enableSuggestChanges,
} from '@handlewithcare/prosemirror-suggest-changes';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import * as React from 'react';
import { resolveBlockElement } from '@/components/design-doc/editor-outline';
import type { DesignDocEditor } from '@/components/design-doc/editor-schema';
import {
  collectSuggestions,
  type SuggestionListItem,
  suggestionSelector,
} from '@/components/design-doc/suggestions';
import type {
  DocumentMode,
  SuggestionDispatch,
} from '@/components/design-doc/suggestions-rail';

/*
 * The right rail's state (plan phase 5): comment threads and pending
 * suggestions in one document-order list, Google-Docs style. Kept out of
 * suggestions-rail.tsx so that module exports only components (Fast
 * Refresh).
 */

/**
 * The document mode (plan §4): Editing applies edits, Suggesting captures
 * them as suggestion marks. The flag is editor-level and local — each
 * person picks their own mode.
 */
export function useDocumentMode(editor: DesignDocEditor): {
  mode: DocumentMode;
  setMode: React.Dispatch<React.SetStateAction<DocumentMode>>;
} {
  const [mode, setMode] = React.useState<DocumentMode>('editing');
  React.useEffect(() => {
    try {
      const view = editor.prosemirrorView;
      if (mode === 'suggesting')
        enableSuggestChanges(view.state, view.dispatch);
      else disableSuggestChanges(view.state, view.dispatch);
    } catch {
      // Not mounted yet; the default (disabled) matches the initial mode.
    }
  }, [mode, editor]);
  return { mode, setMode };
}

/** The full review rail's state and behaviour: {@link RailList}'s props. */
export interface ReviewRail {
  /** Gates mounting the thread list — its subscription caches its first
   * snapshot, so mounting before the initial sync can leave it stuck empty. */
  synced: boolean;
  railOpen: boolean;
  setRailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  threadFilter: 'open' | 'resolved' | 'all';
  setThreadFilter: React.Dispatch<
    React.SetStateAction<'open' | 'resolved' | 'all'>
  >;
  suggestions: SuggestionListItem[];
  suggestionDispatch: SuggestionDispatch;
  activeSuggestionId: string | null;
  selectSuggestion: (item: SuggestionListItem) => void;
  onDocumentClick: (event: React.MouseEvent) => void;
  pendingComment: boolean;
  pendingCommentFrom: number | null;
}

/**
 * All comment UI lives in the rail: comment threads and pending suggestions
 * (plan phase 5), Google-Docs style. The two halves are coupled both ways —
 * selecting a thread clears the active suggestion, and activating a
 * suggestion clears the thread selection — so they're one hook, not two.
 */
export function useReviewRail(
  editor: DesignDocEditor,
  provider: HocuspocusProvider,
  mode: DocumentMode,
): ReviewRail {
  const [synced, setSynced] = React.useState(false);
  React.useEffect(() => {
    if (provider.synced) {
      setSynced(true);
      return;
    }
    const onSynced = () => setSynced(true);
    provider.on('synced', onSynced);
    return () => {
      provider.off('synced', onSynced);
    };
  }, [provider]);
  const [railOpen, setRailOpen] = React.useState(true);
  // Selecting a thread (clicking a marked run) or starting a new comment
  // must bring the rail back if hidden.
  const selectedThreadId = useExtensionState(CommentsExtension, {
    editor,
    selector: (state) => state?.selectedThreadId,
  });
  const pendingComment = useExtensionState(CommentsExtension, {
    editor,
    selector: (state) => state?.pendingComment ?? false,
  });
  // The pending comment's anchor: the selection it was started over. Stable
  // while pending — any selection change stops the pending comment.
  const pendingCommentFrom = React.useMemo(() => {
    if (!pendingComment) return null;
    try {
      return editor.prosemirrorState.selection.from;
    } catch {
      return null;
    }
  }, [pendingComment, editor]);
  const [threadFilter, setThreadFilter] = React.useState<
    'open' | 'resolved' | 'all'
  >('open');

  // The pending suggestions, rescanned from the marks on every change —
  // local and remote transactions both fire the editor-change callback.
  const [suggestions, setSuggestions] = React.useState<SuggestionListItem[]>(
    [],
  );
  const recomputeSuggestions = React.useCallback(() => {
    try {
      setSuggestions(collectSuggestions(editor.prosemirrorState));
    } catch {
      // Not mounted yet.
    }
  }, [editor]);
  useEditorChange(recomputeSuggestions, editor);
  React.useEffect(() => {
    provider.on('synced', recomputeSuggestions);
    recomputeSuggestions();
    return () => {
      provider.off('synced', recomputeSuggestions);
    };
  }, [provider, recomputeSuggestions]);
  // Accepting or rejecting dispatches through the live view so the change
  // syncs like any other edit. The commands skip the suggesting transform.
  const suggestionDispatch = React.useMemo<SuggestionDispatch>(
    () => ({
      perSuggestion: (command, id) => {
        const view = editor.prosemirrorView;
        command(id)(view.state, view.dispatch);
      },
      all: (command) => {
        const view = editor.prosemirrorView;
        command(view.state, view.dispatch);
      },
    }),
    [editor],
  );
  // Entering Suggesting mode surfaces where the suggestions will land.
  React.useEffect(() => {
    if (mode === 'suggesting') setRailOpen(true);
  }, [mode]);
  // The active suggestion (Google-Docs behaviour): clicking marked text
  // highlights its card, clicking the card highlights and scrolls to the
  // text. Local UI state — nothing syncs.
  const [activeSuggestionId, setActiveSuggestionId] = React.useState<
    string | null
  >(null);
  React.useEffect(() => {
    if (selectedThreadId !== undefined || pendingComment) setRailOpen(true);
    if (selectedThreadId !== undefined) setActiveSuggestionId(null);
  }, [selectedThreadId, pendingComment]);
  React.useEffect(() => {
    if (
      activeSuggestionId !== null &&
      !suggestions.some((item) => String(item.id) === activeSuggestionId)
    ) {
      setActiveSuggestionId(null);
    }
  }, [suggestions, activeSuggestionId]);
  // Card click: activate and bring the marked text into view. Block-level
  // marks render display:contents (no box), so fall back to the enclosing
  // block element.
  const selectSuggestion = React.useCallback(
    (item: SuggestionListItem) => {
      setActiveSuggestionId(String(item.id));
      // The thread card's blur keeps its selection when focus lands on a
      // non-focusable target, so activating a suggestion must clear it.
      editor.getExtension(CommentsExtension)?.selectThread(undefined);
      try {
        const marked = editor.prosemirrorView.dom.querySelector(
          suggestionSelector(String(item.id)),
        );
        const target =
          marked !== null && marked.getClientRects().length > 0
            ? marked
            : (marked?.firstElementChild ??
              (item.blockId === null
                ? null
                : resolveBlockElement(item.blockId)));
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        // Not mounted yet.
      }
    },
    [editor],
  );
  // Text click: activate the card; any other click clears the highlight.
  const onDocumentClick = React.useCallback(
    (event: React.MouseEvent) => {
      console.info('here', event);
      const marked = (event.target as HTMLElement).closest(
        'ins[data-id], del[data-id], span[data-type="modification"][data-id]',
      );
      if (marked instanceof HTMLElement && marked.dataset.id !== undefined) {
        setActiveSuggestionId(marked.dataset.id);
        setRailOpen(true);
        editor.getExtension(CommentsExtension)?.selectThread(undefined);
      } else {
        setActiveSuggestionId(null);
      }
    },
    [editor],
  );
  // Mirror the highlight onto the marks via a dynamic stylesheet. Never
  // touch the marked elements themselves: any mutation inside ProseMirror's
  // DOM triggers its DOM observer, whose re-parse dispatches steps.
  const highlightStyleRef = React.useRef<HTMLStyleElement | null>(null);
  React.useEffect(() => {
    const style = document.createElement('style');
    document.head.appendChild(style);
    highlightStyleRef.current = style;
    return () => {
      style.remove();
      highlightStyleRef.current = null;
    };
  }, []);
  React.useEffect(() => {
    const style = highlightStyleRef.current;
    if (style === null) return;
    if (activeSuggestionId === null) {
      style.textContent = '';
      return;
    }
    const escaped = CSS.escape(activeSuggestionId);
    style.textContent = `
      .dd-editor ins[data-id="${escaped}"] {
        background: color-mix(in oklab, #22c55e 35%, transparent);
      }
      .dd-editor del[data-id="${escaped}"] {
        background: color-mix(in oklab, #ef4444 28%, transparent);
      }
      .dd-editor span[data-type="modification"][data-id="${escaped}"] {
        background: color-mix(in oklab, #eab308 32%, transparent);
      }
    `;
  }, [activeSuggestionId]);

  return {
    synced,
    railOpen,
    setRailOpen,
    threadFilter,
    setThreadFilter,
    suggestions,
    suggestionDispatch,
    activeSuggestionId,
    selectSuggestion,
    onDocumentClick,
    pendingComment,
    pendingCommentFrom,
  };
}
