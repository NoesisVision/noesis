import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
  SideMenuExtension,
} from '@blocknote/core';
import { withCollaboration } from '@blocknote/core/yjs';
import {
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
import { HocuspocusProvider } from '@hocuspocus/provider';
import { DESIGN_DOC_BLOCK_SPECS } from '@repo/design-doc-blocks';
import * as React from 'react';
import * as Y from 'yjs';
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
import { TableOfContents } from '@/components/design-doc/table-of-contents';
import { useTheme } from '@/components/shell/use-theme';

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
    return [
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

export function DesignDocEditorView({
  documentId,
  userName,
  title,
  subtitle,
}: {
  documentId: string;
  userName: string;
  title: string;
  subtitle: string;
}) {
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

  const editor = useCreateBlockNote(
    // `withCollaboration` (not the bare extension) also disables the local
    // history extension — undo must go through Y.UndoManager, or it can
    // revert other collaborators' edits — and seeds the collab-safe
    // placeholder content the fragment sync then replaces.
    withCollaboration({
      schema: designDocSchema,
      collaboration: {
        fragment: provider.document.getXmlFragment(COLLAB_FRAGMENT),
        user: { name: userName, color: cursorColor(userName) },
        provider: { awareness: provider.awareness ?? undefined },
      },
    }),
    [provider, userName],
  );

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
  const activeId = useScrollSpy(outline, scrollRef, resolveBlockElement);
  const { theme } = useTheme();

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
          <h1 className="mb-1 px-[54px] text-3xl leading-tight font-semibold">
            {title}
          </h1>
          <div className="mb-8 px-[54px] text-[13px] text-muted-foreground">
            {subtitle}
          </div>
          <BlockNoteView
            editor={editor}
            slashMenu={false}
            sideMenu={false}
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
    </div>
  );
}
