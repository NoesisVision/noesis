import { filterSuggestionItems } from '@blocknote/core';
import {
  BlockNoteContext,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { MessageSquareTextIcon } from 'lucide-react';
import * as React from 'react';
import { useActiveEditableRing } from '@/components/design-doc/active-block';
import {
  type EditorAccount,
  useCollabEditor,
} from '@/components/design-doc/collab-session';
import { useThreadAnchorPatch } from '@/components/design-doc/comment-thread-anchor';
import {
  CommentComponents,
  RailComposer,
} from '@/components/design-doc/comment-ui';
import { useDocumentOutline } from '@/components/design-doc/editor-outline';
import { PresenceFacepile } from '@/components/design-doc/presence';
import {
  useDocumentMode,
  useReviewRail,
} from '@/components/design-doc/review-rail';
import {
  ModeToggle,
  RailList,
  SuggestionsBulkActions,
} from '@/components/design-doc/suggestions-rail';
import { TableOfContents } from '@/components/design-doc/table-of-contents';
import {
  typedSlashItems,
  useConstrainedDrop,
} from '@/components/design-doc/typed-editing';
import { TypedDragHandleMenu } from '@/components/design-doc/typed-editing-menu';
import { useTheme } from '@/components/shell/use-theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import '@blocknote/shadcn/style.css';
import '@/components/design-doc/design-doc-editor.css';

/*
 * The collaborative editing surface (plan phase 3): BlockNote on the shared
 * Y.Doc, synced through the backend's /collab surface (decision 53). This
 * component is the composition root — it wires together the editor session,
 * the schema-aware editing rules, the outline, and the review rail, then
 * renders them. `useCollabEditor` must run first: every other hook here
 * assumes the editor's extensions (`CommentsExtension`, `SuggestionsExtension`)
 * are already attached.
 */

export function DesignDocEditorView({
  documentId,
  account,
  title,
  subtitle,
}: {
  documentId: string;
  account: EditorAccount;
  title: string;
  subtitle: string;
}) {
  const { editor, provider } = useCollabEditor(documentId, account);

  // Dev-only handle for smoke tests: lets a browser-automation session drive
  // the editor (selection, comments extension) without fighting the UI.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as { __ddEditor?: unknown }).__ddEditor = editor;
    return () => {
      delete (window as { __ddEditor?: unknown }).__ddEditor;
    };
  }, [editor]);

  useThreadAnchorPatch(editor);
  const { mode, setMode } = useDocumentMode(editor);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const { outline, activeId, navigate } = useDocumentOutline(
    editor,
    provider,
    scrollRef,
  );
  useConstrainedDrop(editor, scrollRef);
  useActiveEditableRing(editor, scrollRef);
  const { theme } = useTheme();

  const {
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
  } = useReviewRail(editor, provider, mode);

  const blockNoteContext = React.useMemo(
    () => ({ editor: editor as never, colorSchemePreference: theme }),
    [editor, theme],
  );

  return (
    <div className="dd-editor flex h-full min-h-0 overflow-hidden">
      <TableOfContents
        outline={outline}
        activeId={activeId}
        onNavigate={navigate}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click routing only — keyboard users reach suggestions via the rail. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: same — the handler only routes clicks on suggestion marks. */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onClick={onDocumentClick}
      >
        <div className="mx-auto max-w-[820px] px-6 pt-10 pb-40">
          <div className="flex items-start justify-between gap-4 px-[54px]">
            <h1 className="mb-1 text-3xl leading-tight font-semibold">
              {title}
            </h1>
            <div className="flex shrink-0 items-center gap-3 pt-2">
              <ModeToggle mode={mode} onChange={setMode} />
              <PresenceFacepile provider={provider} />
              <Button
                variant={railOpen ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                aria-label="Toggle comments"
                onClick={() => setRailOpen((open) => !open)}
              >
                <MessageSquareTextIcon className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mb-8 px-[54px] text-[13px] text-muted-foreground">
            {subtitle}
          </div>
          <BlockNoteView
            editor={editor}
            slashMenu={false}
            sideMenu={false}
            // The default comments UI is replaced by the mention-aware
            // controllers below.
            comments={false}
            // Follow the app's theme toggle, not the OS preference BlockNote
            // would otherwise read.
            theme={theme}
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) =>
                filterSuggestionItems(typedSlashItems(editor), query)
              }
            />
            <SideMenuController
              sideMenu={(props) => (
                <SideMenu {...props} dragHandleMenu={TypedDragHandleMenu} />
              )}
            />
          </BlockNoteView>
        </div>
      </div>
      {railOpen && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-border">
          <CommentComponents>
            <BlockNoteContext.Provider value={blockNoteContext}>
              <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                <span className="mr-auto text-[11px] font-semibold tracking-wider uppercase">
                  Comments & suggestions
                </span>
                {(['open', 'resolved', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs capitalize',
                      filter === threadFilter
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                    onClick={() => setThreadFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              {suggestions.length > 0 && (
                <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
                  <span className="mr-auto text-xs text-muted-foreground">
                    {suggestions.length} pending suggestion
                    {suggestions.length === 1 ? '' : 's'}
                  </span>
                  <SuggestionsBulkActions
                    count={suggestions.length}
                    dispatch={suggestionDispatch}
                  />
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {synced && (
                  <RailList
                    suggestions={suggestions}
                    dispatch={suggestionDispatch}
                    threadFilter={threadFilter}
                    activeSuggestionId={activeSuggestionId}
                    onSelectSuggestion={selectSuggestion}
                    composer={
                      <RailComposer
                        editor={editor as never}
                        pending={pendingComment}
                      />
                    }
                    composerFrom={pendingCommentFrom}
                  />
                )}
              </div>
            </BlockNoteContext.Provider>
          </CommentComponents>
        </aside>
      )}
    </div>
  );
}
