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
  ThreadsSidebar,
  useCreateBlockNote,
  useEditorChange,
  useEditorSelectionChange,
  useExtensionState,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
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
      ],
      collaboration: {
        fragment: provider.document.getXmlFragment(COLLAB_FRAGMENT),
        user: { name: userName, color: cursorColor(userName) },
        provider: { awareness: provider.awareness ?? undefined },
      },
    }),
    [provider, userName, threadStore, resolveUsers],
  );

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

  // The threads rail (plan phase 4, slice 2): ThreadsSidebar rendered
  // outside the BlockNoteView needs the editor handed over by context. It
  // mounts only once the provider has synced — the sidebar's thread
  // subscription caches its first snapshot, so mounting before the initial
  // sync can leave it stuck on an empty thread list.
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
  React.useEffect(() => {
    if (selectedThreadId !== undefined || pendingComment) setRailOpen(true);
  }, [selectedThreadId, pendingComment]);
  const [threadFilter, setThreadFilter] = React.useState<
    'open' | 'resolved' | 'all'
  >('open');
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
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[820px] px-6 pt-10 pb-40">
          <div className="flex items-start justify-between gap-4 px-[54px]">
            <h1 className="mb-1 text-3xl leading-tight font-semibold">
              {title}
            </h1>
            <div className="flex shrink-0 items-center gap-3 pt-2">
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
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            <span className="mr-auto text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Comments
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
          <CommentComponents>
            <BlockNoteContext.Provider value={blockNoteContext}>
              <RailComposer editor={editor as never} pending={pendingComment} />
              <div className="dd-threads flex-1 overflow-auto p-2">
                {synced && (
                  <ThreadsSidebar filter={threadFilter} sort="position" />
                )}
              </div>
            </BlockNoteContext.Provider>
          </CommentComponents>
        </aside>
      )}
    </div>
  );
}
