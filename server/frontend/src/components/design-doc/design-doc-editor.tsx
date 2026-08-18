import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  SideMenuExtension,
} from '@blocknote/core';
import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { withCollaboration, YjsThreadStore } from '@blocknote/core/yjs';
import {
  BlockNoteContext,
  type DefaultReactSuggestionItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  useCreateBlockNote,
  useEditorChange,
  useEditorSelectionChange,
  useExtensionState,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import {
  disableSuggestChanges,
  enableSuggestChanges,
} from '@handlewithcare/prosemirror-suggest-changes';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  blockGroup,
  DESIGN_DOC_BLOCK_SPECS,
  type DesignDocBlockType,
} from '@repo/design-doc-blocks';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquareTextIcon } from 'lucide-react';
import * as React from 'react';
import * as Y from 'yjs';
import { commentEditorSchema } from '@/components/design-doc/comment-schema';
import {
  CommentComponents,
  RailComposer,
} from '@/components/design-doc/comment-ui';
import {
  buildOutlineFromBlocks,
  type OutlineItem,
  resolveBlockElement,
  useScrollSpy,
} from '@/components/design-doc/editor-outline';
import {
  type DesignDocEditor,
  designDocSchema,
} from '@/components/design-doc/editor-schema';
import { PresenceFacepile } from '@/components/design-doc/presence';
import {
  collectSuggestions,
  type SuggestionListItem,
  SuggestionsExtension,
} from '@/components/design-doc/suggestions';
import {
  type DocumentMode,
  ModeToggle,
  RailList,
  type SuggestionDispatch,
  SuggestionsBulkActions,
} from '@/components/design-doc/suggestions-rail';
import { TableOfContents } from '@/components/design-doc/table-of-contents';
import { useTheme } from '@/components/shell/use-theme';
import { Button } from '@/components/ui/button';
import { accountsQueryOptions } from '@/lib/accounts';
import { cn } from '@/lib/utils';

import '@blocknote/shadcn/style.css';
import '@/components/design-doc/design-doc-editor.css';

/*
 * The collaborative editing surface (plan phase 3): BlockNote on the shared
 * Y.Doc, synced through the backend's /collab surface (decision 53). Clients
 * only ever sync into a server-seeded document. The slash menu offers only
 * the typed elements the schema allows at the caret, and the drag-handle
 * menu offers deletion only where the schema allows the element to be absent.
 */

/** The fragment name must match the server's seeding (design-doc-editor.server.ts). */
const COLLAB_FRAGMENT = 'document-store';

function collabUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/collab`;
}

/** A stable per-user cursor colour from the account name. */
function cursorColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 65%, 45%)`;
}

/** DOM selector matching every rendered mark of one suggestion. */
function suggestionSelector(id: string): string {
  const escaped = CSS.escape(id);
  return `ins[data-id="${escaped}"], del[data-id="${escaped}"], span[data-type="modification"][data-id="${escaped}"]`;
}

type BlockLike = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

/** The reorder group of a live block, null for fixed-place or untyped ones. */
function groupOfBlock(block: BlockLike | undefined): string | null {
  if (block === undefined || !(block.type in DESIGN_DOC_BLOCK_SPECS)) {
    return null;
  }
  return blockGroup(
    block.type as DesignDocBlockType,
    block.props as Record<string, string | number | boolean>,
  );
}

/**
 * Paste coercion (plan §7, phase-3 gap): clipboard text lands as plain text
 * in the typed block at the caret, never as `paragraph` blocks the
 * projection would ignore. Extra lines become sibling blocks of the same
 * type where the schema keeps a list (the block has a reorder group), with
 * the owner props cloned; elsewhere they fold into one line. BlockNote's own
 * clipboard format still round-trips through the default handler — it
 * re-inserts typed blocks of this same schema.
 */
function typedPasteHandler({
  event,
  editor,
  defaultPasteHandler,
}: {
  event: ClipboardEvent;
  editor: DesignDocEditor;
  defaultPasteHandler: () => boolean | undefined;
}): boolean | undefined {
  if (event.clipboardData?.types.includes('blocknote/html') === true) {
    return defaultPasteHandler();
  }
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (text === '') return false;
  let current: BlockLike;
  try {
    current = editor.getTextCursorPosition().block as unknown as BlockLike;
  } catch {
    return false;
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const [first, ...rest] = lines;
  if (first === undefined) return true;
  if (rest.length === 0 || groupOfBlock(current) === null) {
    editor.insertInlineContent([lines.join(' ')]);
    return true;
  }
  editor.insertInlineContent([first]);
  // Only the owner/discriminator props carry over — content-ish props
  // (a field's name, a note) must not be stamped onto every pasted line.
  const carried: Record<string, unknown> = {};
  for (const key of ['useCaseId', 'direction', 'scope']) {
    if (key in current.props) carried[key] = current.props[key];
  }
  editor.insertBlocks(
    rest.map((line) => ({
      type: current.type,
      props: { ...carried },
      content: line,
    })) as never,
    current.id,
    'after',
  );
  return true;
}

/** The use case the caret sits in, from the flat block order. */
function enclosingUseCaseId(
  editor: DesignDocEditor,
  currentBlockId: string,
): string | null {
  let useCaseId: string | null = null;
  for (const block of editor.document as unknown as BlockLike[]) {
    if (block.type === 'useCaseHeading') useCaseId = block.id;
    if (block.type === 'contextHeading' || block.type === 'serviceHeading') {
      useCaseId = null;
    }
    if (block.id === currentBlockId) return useCaseId;
    if (
      typeof block.props.useCaseId === 'string' &&
      block.props.useCaseId !== ''
    ) {
      useCaseId = block.props.useCaseId;
    }
  }
  return useCaseId;
}

/**
 * The one block menu (plan §4): the typed elements insertable at the caret,
 * never the default set. Document-level elements outside the use cases; a use
 * case's own elements inside one, with their owner stamped on the new block.
 */
function typedSlashItems(
  editor: DesignDocEditor,
): DefaultReactSuggestionItem[] {
  const current = editor.getTextCursorPosition().block as unknown as BlockLike;
  const useCaseId = enclosingUseCaseId(editor, current.id);

  const item = (
    title: string,
    type: string,
    props: Record<string, string>,
  ): DefaultReactSuggestionItem => ({
    title,
    group: useCaseId === null ? 'Document' : 'Use case',
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(
        editor as never,
        { type, props } as never,
      );
    },
  });

  if (useCaseId === null) {
    // The goal is a single slot — offered only while its block is absent, so
    // the "not written yet" line has an insert path.
    const hasGoal = (editor.document as unknown as BlockLike[]).some(
      (block) => block.type === 'goal',
    );
    return [
      ...(hasGoal ? [] : [item('Goal', 'goal', {})]),
      item('Context paragraph', 'contextParagraph', {}),
      item('Target outcome', 'outcome', {}),
      item('Scope item (in scope)', 'scopeItem', { scope: 'in' }),
      item('Scope item (out of scope)', 'scopeItem', { scope: 'out' }),
      item('Actor', 'actor', {}),
    ];
  }
  return [
    item('Rule', 'rule', { useCaseId }),
    item('Input field', 'fieldRow', { useCaseId, direction: 'input' }),
    item('Output field', 'fieldRow', { useCaseId, direction: 'output' }),
    item('Acceptance scenario', 'scenario', {
      useCaseId,
      data: JSON.stringify({ title: '', steps: [] }),
    }),
    item('Quality attribute', 'qualityAttribute', { useCaseId }),
    item('Summary', 'useCaseSummary', { useCaseId }),
    item('Description', 'useCaseDescription', { useCaseId }),
  ];
}

const removable = (type: string): boolean =>
  DESIGN_DOC_BLOCK_SPECS[type as keyof typeof DESIGN_DOC_BLOCK_SPECS]
    ?.removable ?? true;

/**
 * Schema-aware deletion (plan §4): list members can be deleted, elements the
 * schema requires cannot. The hovered block comes from the side-menu
 * extension's state, the same source the default menu items read.
 */
function TypedDragHandleMenu() {
  const hovered = useExtensionState(SideMenuExtension, {
    selector: (state: { block?: BlockLike } | undefined) => state?.block,
  }) as BlockLike | undefined;

  return (
    <DragHandleMenu>
      {hovered !== undefined && removable(hovered.type) ? (
        <RemoveBlockItem>Delete</RemoveBlockItem>
      ) : (
        <div className="px-3 py-1.5 text-xs text-muted-foreground">
          Required by the schema
        </div>
      )}
    </DragHandleMenu>
  );
}

/** The signed-in account, as the editor needs it. */
export interface EditorAccount {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
}

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
  const userName = account.name || account.login;
  // One provider (and Y.Doc) per mounted editor; the server seeded the
  // document, the client only syncs into it.
  const [provider] = React.useState(
    () =>
      new HocuspocusProvider({
        url: collabUrl(),
        name: documentId,
        document: new Y.Doc(),
      }),
  );
  // StrictMode-safe lifecycle: the dev-mode simulated unmount runs the
  // cleanup once and re-runs the setup synchronously in the same commit, so
  // the cleanup must be reversible — `destroy()` here permanently unhooks the
  // provider from the Y.Doc and silently turns the editor local-only. Detach
  // instead, and only destroy once a deferred check proves the unmount was
  // real (a StrictMode remount has reattached by the time the task runs).
  React.useEffect(() => {
    provider.attach();
    return () => {
      provider.detach();
      setTimeout(() => {
        if (!provider.isAttached) provider.destroy();
      }, 0);
    };
  }, [provider]);

  // Threads live in a `threads` Y.Map of the same Y.Doc (decision 55): sync
  // over the existing /collab surface, persistence with the document state.
  const threadStore = React.useMemo(
    () =>
      new YjsThreadStore(
        account.id,
        provider.document.getMap('threads'),
        new DefaultThreadStoreAuth(account.id, 'editor'),
      ),
    [provider, account.id],
  );

  const queryClient = useQueryClient();
  const resolveUsers = React.useCallback(
    async (ids: string[]) => {
      const accounts = await queryClient.fetchQuery(accountsQueryOptions());
      return ids.map((id) => {
        const match = accounts.find((candidate) => candidate.id === id);
        return {
          id,
          username: match === undefined ? id : match.name || match.login,
          avatarUrl: match?.avatarUrl ?? '',
        };
      });
    },
    [queryClient],
  );

  const editor = useCreateBlockNote(
    // `withCollaboration` (not the bare extension) also disables the local
    // history extension — undo must go through Y.UndoManager, or it can
    // revert other collaborators' edits — and seeds the collab-safe
    // placeholder content the fragment sync then replaces.
    withCollaboration({
      schema: designDocSchema,
      pasteHandler: typedPasteHandler,
      extensions: [
        CommentsExtension({
          threadStore,
          resolveUsers,
          schema: commentEditorSchema,
        }),
        SuggestionsExtension({ accountId: account.id }),
      ],
      collaboration: {
        fragment: provider.document.getXmlFragment(COLLAB_FRAGMENT),
        user: { name: userName, color: cursorColor(userName) },
        provider: { awareness: provider.awareness ?? undefined },
      },
    }),
    [provider, userName, threadStore, resolveUsers, account.id],
  );

  // The document mode (plan §4): Editing applies edits, Suggesting captures
  // them as suggestion marks. The flag is editor-level and local — each
  // person picks their own mode.
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

  // The thread anchor pair from plan §3.8, `{ elementId, quote }`: the
  // floating composer calls `createThread` without metadata, so the
  // extension's method is wrapped to stamp the enclosing element's id and
  // the selected text on every new thread. With it, an orphaned mark
  // degrades a thread to its element with the quote as evidence.
  React.useEffect(() => {
    const comments = editor.getExtension(CommentsExtension);
    if (comments === undefined) return;
    const original = comments.createThread;
    const patchable = comments as { createThread: typeof original };
    patchable.createThread = (options) => {
      let anchor: Record<string, string> = {};
      try {
        const block = editor.getTextCursorPosition()
          .block as unknown as BlockLike;
        anchor = { elementId: block.id, quote: editor.getSelectedText() };
      } catch {
        // No selection to anchor to; the mark alone will have to do.
      }
      return original({
        ...options,
        metadata: { ...(options.metadata ?? {}), ...anchor },
      });
    };
    return () => {
      patchable.createThread = original;
    };
  }, [editor]);

  // Dev-only handle for smoke tests: lets a browser-automation session drive
  // the editor (selection, comments extension) without fighting the UI.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as { __ddEditor?: unknown }).__ddEditor = editor;
    return () => {
      delete (window as { __ddEditor?: unknown }).__ddEditor;
    };
  }, [editor]);

  // Enrich the awareness `user` state the cursors already broadcast with the
  // account id and avatar, so presence can show faces and de-duplicate tabs.
  React.useEffect(() => {
    provider.awareness?.setLocalStateField('user', {
      name: userName,
      color: cursorColor(userName),
      id: account.id,
      avatarUrl: account.avatarUrl,
    });
  }, [provider, userName, account.id, account.avatarUrl]);

  // The table of contents follows the live block list — the outline is the
  // same numbering the prototype fixes, recomputed on every editor change.
  const [outline, setOutline] = React.useState<OutlineItem[]>([]);
  const recomputeOutline = React.useCallback(() => {
    setOutline(
      buildOutlineFromBlocks(
        editor.document as unknown as Parameters<
          typeof buildOutlineFromBlocks
        >[0],
      ),
    );
  }, [editor]);
  useEditorChange(recomputeOutline, editor);
  React.useEffect(() => {
    // The first sync arrives outside the editor-change callback's lifetime.
    provider.on('synced', recomputeOutline);
    recomputeOutline();
    return () => {
      provider.off('synced', recomputeOutline);
    };
  }, [provider, recomputeOutline]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // Drag and drop constrained to same-group siblings (plan §4, the
  // prototype's data-group rule): a block drag may only drop onto a block of
  // the same reorder group. Capture phase at the document level runs ahead
  // of BlockNote's own document-level drop handling; anything else is
  // cancelled — including foreign drops into the pane, which would insert
  // untyped blocks the projection ignores.
  React.useEffect(() => {
    const onDropCapture = (event: DragEvent) => {
      const cancel = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const over = document.elementFromPoint(event.clientX, event.clientY);
      const html = event.dataTransfer?.getData('blocknote/html') ?? '';
      if (html === '') {
        // Not a block drag: refuse foreign content dropped into the pane.
        if (over !== null && scrollRef.current?.contains(over) === true) {
          cancel();
        }
        return;
      }
      const draggedId = /data-id="([^"]+)"/.exec(html)?.[1];
      const targetId = over?.closest('[data-id]')?.getAttribute('data-id');
      const dragged =
        draggedId === undefined
          ? undefined
          : (editor.getBlock(draggedId) as unknown as BlockLike | undefined);
      const target =
        targetId == null
          ? undefined
          : (editor.getBlock(targetId) as unknown as BlockLike | undefined);
      const draggedGroup = groupOfBlock(dragged);
      if (draggedGroup === null || draggedGroup !== groupOfBlock(target)) {
        cancel();
      }
    };
    document.addEventListener('drop', onDropCapture, true);
    return () => document.removeEventListener('drop', onDropCapture, true);
  }, [editor]);
  const activeId = useScrollSpy(outline, scrollRef, resolveBlockElement);
  const { theme } = useTheme();

  // The rail list rendered outside the BlockNoteView needs the editor
  // handed over by context. It mounts only once the provider has synced —
  // the thread subscription caches its first snapshot, so mounting before
  // the initial sync can leave it stuck on an empty thread list.
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
  // All comment UI lives in the rail: selecting a thread (clicking a marked
  // run) or starting a new comment must bring the rail back if hidden.
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
  React.useEffect(() => {
    if (selectedThreadId !== undefined || pendingComment) setRailOpen(true);
    if (selectedThreadId !== undefined) setActiveSuggestionId(null);
  }, [selectedThreadId, pendingComment]);
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
  const blockNoteContext = React.useMemo(
    () => ({ editor: editor as never, colorSchemePreference: theme }),
    [editor, theme],
  );

  // The prototype's one-active-element affordance: the block the caret sits
  // in carries the focus ring (`.dd-active`), cleared when focus leaves the
  // editor. Imperative on purpose — a selection change should not re-render
  // the document.
  const activeEditable = React.useRef<Element | null>(null);
  const setActiveEditable = React.useCallback((element: Element | null) => {
    if (element === activeEditable.current) return;
    activeEditable.current?.classList.remove('dd-active');
    element?.classList.add('dd-active');
    activeEditable.current = element;
  }, []);
  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition()
        .block as unknown as BlockLike;
      setActiveEditable(
        resolveBlockElement(block.id)?.querySelector('.dd-editable') ?? null,
      );
    } catch {
      setActiveEditable(null);
    }
  }, editor);
  React.useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller === null) return;
    const onFocusOut = (event: FocusEvent) => {
      if (
        event.relatedTarget === null ||
        !scroller.contains(event.relatedTarget as Node)
      ) {
        setActiveEditable(null);
      }
    };
    scroller.addEventListener('focusout', onFocusOut);
    return () => scroller.removeEventListener('focusout', onFocusOut);
  }, [setActiveEditable]);

  // Scroll the document pane itself so the jump never bubbles to an
  // ancestor; the offset keeps the block clear of the pane's top edge.
  const navigate = (id: string) => {
    const scroller = scrollRef.current;
    const element = resolveBlockElement(id);
    if (scroller === null || element === null) return;
    const top =
      element.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      12;
    scroller.scrollTo({ top });
  };

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
