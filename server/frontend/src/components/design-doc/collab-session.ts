import {
  CommentsExtension,
  DefaultThreadStoreAuth,
} from '@blocknote/core/comments';
import { withCollaboration, YjsThreadStore } from '@blocknote/core/yjs';
import { useCreateBlockNote } from '@blocknote/react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import * as Y from 'yjs';
import { commentEditorSchema } from '@/components/design-doc/comment-schema';
import {
  type DesignDocEditor,
  designDocSchema,
} from '@/components/design-doc/editor-schema';
import { SuggestionsExtension } from '@/components/design-doc/suggestions';
import {
  typedPasteHandler,
  useDragGroupDropCursor,
} from '@/components/design-doc/typed-editing';
import { accountsQueryOptions } from '@/lib/accounts';

/*
 * The collaborative editing surface (plan phase 3): BlockNote on the shared
 * Y.Doc, synced through the backend's /collab surface (decision 53). Clients
 * only ever sync into a server-seeded document. Threads live in a `threads`
 * Y.Map of the same Y.Doc (decision 55): sync over the existing /collab
 * surface, persistence with the document state.
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

/** The signed-in account, as the editor needs it. */
export interface EditorAccount {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
}

/**
 * The provider, thread store, and collaborative editor instance for one
 * mounted editor — one of each per `documentId`. The server seeded the
 * document; the client only ever syncs into it.
 */
export function useCollabEditor(
  documentId: string,
  account: EditorAccount,
): { editor: DesignDocEditor; provider: HocuspocusProvider } {
  const userName = account.name || account.login;
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

  // Only same-reorder-group targets ever light up while dragging a block
  // (typed-editing.ts) — the drop itself is separately vetoed by
  // useConstrainedDrop in design-doc-editor.tsx.
  const computeDropPosition = useDragGroupDropCursor();

  const editor = useCreateBlockNote(
    // `withCollaboration` (not the bare extension) also disables the local
    // history extension — undo must go through Y.UndoManager, or it can
    // revert other collaborators' edits — and seeds the collab-safe
    // placeholder content the fragment sync then replaces.
    withCollaboration({
      schema: designDocSchema,
      pasteHandler: typedPasteHandler,
      dropCursor: { hooks: { computeDropPosition } },
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
    [
      provider,
      userName,
      threadStore,
      resolveUsers,
      account.id,
      computeDropPosition,
    ],
  );

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

  return { editor, provider };
}
