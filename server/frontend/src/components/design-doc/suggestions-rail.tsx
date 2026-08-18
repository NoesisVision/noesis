import { CommentsExtension, type ThreadData } from '@blocknote/core/comments';
import {
  getReferenceText,
  Thread,
  useBlockNoteEditor,
  useExtension,
  useExtensionState,
  useThreads,
} from '@blocknote/react';
import {
  applySuggestion,
  applySuggestions,
  revertSuggestion,
  revertSuggestions,
} from '@handlewithcare/prosemirror-suggest-changes';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import type { SuggestionListItem } from '@/components/design-doc/suggestions';
import { Button } from '@/components/ui/button';
import { type AccountSummary, accountsQueryOptions } from '@/lib/accounts';
import { cn } from '@/lib/utils';

/*
 * The right rail's merged list (plan phase 5): comment threads and pending
 * suggestions in one document-order list, Google-Docs style. Threads render
 * through BlockNote's own Thread component; the list shell replaces
 * ThreadsSidebar because that component owns its list and cannot interleave
 * foreign items. Accepting or rejecting a suggestion dispatches through the
 * shared view, so the write lands in the Y.Doc and every collaborator (and
 * the server projection) sees the same outcome.
 */

/** The document modes (plan §4). Both are editor-level. */
export type DocumentMode = 'editing' | 'suggesting';

const MODES: { mode: DocumentMode; label: string }[] = [
  { mode: 'editing', label: 'Editing' },
  { mode: 'suggesting', label: 'Suggesting' },
];

/** The Editing / Suggesting segmented control. */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: DocumentMode;
  onChange: (mode: DocumentMode) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {MODES.map((entry) => (
        <button
          key={entry.mode}
          type="button"
          aria-pressed={entry.mode === mode}
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            entry.mode === mode
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
          onClick={() => onChange(entry.mode)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

/** Dispatch a suggest-changes command through the live view. */
export interface SuggestionDispatch {
  perSuggestion: (command: typeof applySuggestion, id: string | number) => void;
  all: (command: typeof applySuggestions) => void;
}

function AuthorAvatar({ account }: { account: AccountSummary | undefined }) {
  if (account !== undefined && account.avatarUrl !== '') {
    return (
      <img src={account.avatarUrl} alt="" className="size-6 rounded-full" />
    );
  }
  const name = account === undefined ? '?' : account.name || account.login;
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function SuggestionCard({
  item,
  account,
  selected,
  onSelect,
  dispatch,
}: {
  item: SuggestionListItem;
  account: AccountSummary | undefined;
  selected: boolean;
  onSelect: (item: SuggestionListItem) => void;
  dispatch: SuggestionDispatch;
}) {
  const authorName =
    account === undefined ? 'Unknown' : account.name || account.login;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: selection needs no keyboard path — the accept/reject buttons are tabbable, and selecting only echoes the highlight.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same.
    <div
      data-suggestion-card={String(item.id)}
      className={cn(
        'cursor-pointer rounded-lg border border-border bg-card p-3 text-sm',
        selected && 'border-primary/50 ring-1 ring-primary/40',
      )}
      onClick={() => onSelect(item)}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <AuthorAvatar account={account} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{authorName}</div>
          <div className="text-[11px] text-muted-foreground">Suggestion</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label="Accept suggestion"
          title="Accept"
          onClick={(event) => {
            event.stopPropagation();
            dispatch.perSuggestion(applySuggestion, item.id);
          }}
        >
          <CheckIcon className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          aria-label="Reject suggestion"
          title="Reject"
          onClick={(event) => {
            event.stopPropagation();
            dispatch.perSuggestion(revertSuggestion, item.id);
          }}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      {item.deleted !== '' && (
        <div className="text-[13px] break-words">
          <span className="mr-1 font-medium text-destructive">Delete:</span>
          <span className="text-muted-foreground line-through">
            {item.deleted}
          </span>
        </div>
      )}
      {item.inserted !== '' && (
        <div className="text-[13px] break-words">
          <span className="mr-1 font-medium text-green-600 dark:text-green-500">
            Add:
          </span>
          {item.inserted}
        </div>
      )}
      {item.deleted === '' && item.inserted === '' && item.modified && (
        <div className="text-[13px] text-muted-foreground italic">
          Formatting or attribute change
        </div>
      )}
    </div>
  );
}

/**
 * One thread card: BlockNote's Thread with the sidebar's focus/blur
 * selection wiring (lifted from ThreadsSidebar, which we replaced to
 * interleave suggestions).
 */
function ThreadItem({
  thread,
  selected,
  orphaned,
  referenceText,
}: {
  thread: ThreadData;
  selected: boolean;
  orphaned: boolean;
  referenceText: string;
}) {
  const editor = useBlockNoteEditor();
  const comments = useExtension(CommentsExtension, { editor });

  const onFocus = React.useCallback(
    (event: React.FocusEvent) => {
      if ((event.target as HTMLElement).closest('.bn-action-toolbar')) return;
      comments.selectThread(thread.id);
    },
    [comments, thread.id],
  );
  const onBlur = React.useCallback(
    (event: React.FocusEvent) => {
      if (
        !event.relatedTarget ||
        event.relatedTarget.closest('.bn-action-toolbar')
      ) {
        return;
      }
      // Focusing the reply composer must not unselect the thread.
      const parentThread = event.relatedTarget.closest('.bn-thread');
      if (parentThread === null || !parentThread.contains(event.target)) {
        comments.selectThread(undefined);
      }
    },
    [comments],
  );

  return (
    <Thread
      thread={thread}
      selected={selected}
      orphaned={orphaned}
      referenceText={referenceText}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    />
  );
}

type RailItem =
  | { kind: 'thread'; from: number; thread: ThreadData; orphaned: boolean }
  | { kind: 'suggestion'; from: number; item: SuggestionListItem }
  | { kind: 'composer'; from: number };

/**
 * Comment threads and pending suggestions, merged and sorted by document
 * position; orphaned threads sink to the end (as in ThreadsSidebar). While a
 * comment is pending, its composer slots into the same order at the anchor
 * position, so the card is where the thread will land.
 */
export function RailList({
  suggestions,
  dispatch,
  threadFilter,
  activeSuggestionId,
  onSelectSuggestion,
  composer,
  composerFrom,
}: {
  suggestions: SuggestionListItem[];
  dispatch: SuggestionDispatch;
  threadFilter: 'open' | 'resolved' | 'all';
  activeSuggestionId: string | null;
  onSelectSuggestion: (item: SuggestionListItem) => void;
  composer?: React.ReactNode;
  composerFrom?: number | null;
}) {
  const editor = useBlockNoteEditor();
  const commentsState = useExtensionState(CommentsExtension, { editor });
  const selectedThreadId = commentsState?.selectedThreadId;
  const threadPositions = commentsState?.threadPositions;
  const threads = useThreads();
  const accounts = useQuery(accountsQueryOptions()).data;

  const items = React.useMemo(() => {
    const merged: RailItem[] = [];
    for (const thread of threads.values()) {
      if (threadFilter === 'open' && thread.resolved) continue;
      if (threadFilter === 'resolved' && !thread.resolved) continue;
      const position = threadPositions?.get(thread.id);
      merged.push({
        kind: 'thread',
        from: position?.from ?? Number.MAX_SAFE_INTEGER,
        thread,
        orphaned: position === undefined,
      });
    }
    for (const item of suggestions) {
      merged.push({ kind: 'suggestion', from: item.from, item });
    }
    if (composerFrom !== undefined && composerFrom !== null) {
      merged.push({ kind: 'composer', from: composerFrom });
    }
    return merged.sort((a, b) => a.from - b.from);
  }, [threads, threadPositions, threadFilter, suggestions, composerFrom]);

  // A suggestion activated from its text scrolls its card into view.
  React.useEffect(() => {
    if (activeSuggestionId === null) return;
    document
      .querySelector(
        `[data-suggestion-card="${CSS.escape(activeSuggestionId)}"]`,
      )
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSuggestionId]);

  // A newly opened composer scrolls its card into view.
  React.useEffect(() => {
    if (composerFrom === undefined || composerFrom === null) return;
    document
      .querySelector('[data-rail-composer]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [composerFrom]);

  if (items.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
        No comments or suggestions yet.
      </div>
    );
  }
  return (
    <div className="dd-threads flex flex-col gap-2 p-2">
      {items.map((entry) =>
        entry.kind === 'composer' ? (
          <React.Fragment key="composer">{composer}</React.Fragment>
        ) : entry.kind === 'thread' ? (
          <ThreadItem
            key={entry.thread.id}
            thread={entry.thread}
            selected={entry.thread.id === selectedThreadId}
            orphaned={entry.orphaned}
            referenceText={getReferenceText(
              editor,
              threadPositions?.get(entry.thread.id),
            )}
          />
        ) : (
          <SuggestionCard
            key={String(entry.item.id)}
            item={entry.item}
            account={accounts?.find(
              (candidate) => candidate.id === entry.item.authorId,
            )}
            selected={String(entry.item.id) === activeSuggestionId}
            onSelect={onSelectSuggestion}
            dispatch={dispatch}
          />
        ),
      )}
    </div>
  );
}

/** The Accept all / Reject all pair for the rail header. */
export function SuggestionsBulkActions({
  count,
  dispatch,
}: {
  count: number;
  dispatch: SuggestionDispatch;
}) {
  if (count === 0) return null;
  return (
    <>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
        onClick={() => dispatch.all(applySuggestions)}
      >
        Accept all
      </button>
      <button
        type="button"
        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
        onClick={() => dispatch.all(revertSuggestions)}
      >
        Reject all
      </button>
    </>
  );
}
