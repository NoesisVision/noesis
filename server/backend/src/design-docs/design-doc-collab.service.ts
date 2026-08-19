import { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';
import type { AuthModule } from '../auth/auth.module.js';
import { projectYDoc } from './design-doc-editor.server.js';
import type { DesignDocsRepository } from './design-docs.repository.js';

/*
 * The `/collab` surface (decision 53): Hocuspocus embedded in the backend
 * process, speaking the Yjs sync and awareness protocols over Bun's
 * WebSocket, persisting the encoded Y.Doc in the graph, and refreshing the
 * `DesignDocument` projection cache on every debounced store.
 *
 * The session cookie authenticates the upgrade — the browser sends it with
 * the WebSocket handshake, and `onAuthenticate` verifies it exactly as
 * `requireSession` does. No second token scheme.
 */

const SESSION_COOKIE = 'noesis_session';

function cookieValue(header: string | null, name: string): string | undefined {
  if (header === null) return undefined;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === name) {
      return pair.slice(index + 1).trim();
    }
  }
  return undefined;
}

/** What a `/collab` WebSocket carries between Bun callbacks. */
export interface CollabSocketData {
  connection: ReturnType<Hocuspocus['handleConnection']> | null;
  request: Request;
}

export class DesignDocCollabService {
  readonly hocuspocus: Hocuspocus;
  private readonly designDocs: DesignDocsRepository;

  constructor(designDocs: DesignDocsRepository, authModule: AuthModule) {
    this.designDocs = designDocs;
    this.hocuspocus = new Hocuspocus({
      // The hook throws to refuse; anything else admits the connection.
      onAuthenticate: async ({ request, documentName }) => {
        if (authModule.mode === 'github') {
          const token = cookieValue(
            request.headers.get('cookie'),
            SESSION_COOKIE,
          );
          if (token === undefined) throw new Error('unauthenticated');
          if ((await authModule.sessions.verify(token)) === null) {
            throw new Error('unauthenticated');
          }
        }
        if ((await designDocs.findById(documentName)) === null) {
          throw new Error('unknown document');
        }
      },
      // Loading only ever loads existing state (decision 51.6): a document
      // with no seeded Y.Doc is refused rather than initialised empty.
      onLoadDocument: async ({ document, documentName }) => {
        const state = await this.designDocs.findState(documentName);
        if (state === null) {
          throw new Error(`Design document ${documentName} has no Y.Doc.`);
        }
        Y.applyUpdate(document, state);
        return document;
      },
      // Debounced by Hocuspocus. State first — it is the truth; the
      // projection cache follows, and a projection failure must not lose the
      // editing state it projects.
      onStoreDocument: async ({ document, documentName }) => {
        await this.designDocs.saveState(
          documentName,
          Y.encodeStateAsUpdate(document),
        );
        try {
          await this.designDocs.updateDocument(
            documentName,
            projectYDoc(document),
          );
        } catch (error) {
          console.error(
            `[collab] projection failed for ${documentName} — the block schema let an unprojectable state through: ${String(error)}`,
          );
        }
      },
    });
  }

  /**
   * The Bun.serve integration. `fetch` must snapshot the request before
   * upgrading — Bun frees the native request headers once the upgrade
   * succeeds, and `onAuthenticate` still needs the cookie.
   */
  upgrade(
    request: Request,
    server: {
      upgrade(request: Request, options: { data: CollabSocketData }): boolean;
    },
  ): Response | undefined {
    const snapshot = new Request(request.url, {
      headers: new Headers(request.headers),
    });
    if (
      server.upgrade(request, { data: { connection: null, request: snapshot } })
    ) {
      return undefined;
    }
    return new Response('collab expects a WebSocket upgrade', { status: 400 });
  }

  readonly websocket = {
    open: (ws: { data: CollabSocketData } & WebSocketLike) => {
      ws.data.connection = this.hocuspocus.handleConnection(
        ws,
        ws.data.request,
      );
    },
    message: (
      ws: { data: CollabSocketData },
      message: string | Uint8Array | ArrayBuffer,
    ) => {
      const data =
        typeof message === 'string'
          ? new TextEncoder().encode(message)
          : new Uint8Array(message as ArrayBuffer);
      ws.data.connection?.handleMessage(data);
    },
    close: (ws: { data: CollabSocketData }) => {
      ws.data.connection?.handleClose();
    },
  };

  /**
   * Graceful shutdown: stop taking edits, run every pending store to
   * completion, and wait for the documents to unload.
   *
   * `closeConnections()` on its own is not enough, despite reading like it.
   * It drops the sockets and leaves the debounced `onStoreDocument` timers
   * pending, so a store can still fire *after* the composition root has
   * closed the database — which is how a container stop leaves a torn
   * LadybugDB write-ahead log behind, and the next boot dies on it
   * (decision 62).
   *
   * The sequence mirrors Hocuspocus's own `Server.runDestroy`, which we
   * cannot call: we embed the `Hocuspocus` instance in `Bun.serve` rather
   * than running its HTTP server. Unlike upstream's it is bounded — the
   * platform sends SIGKILL after its grace period, and exiting with the
   * database closed beats being killed with a store half-written.
   */
  async close(timeoutMs = 5_000): Promise<void> {
    const drained = new Promise<void>((resolve) => {
      // Registered before anything closes, so an unload that completes
      // immediately still resolves this.
      this.hocuspocus.configuration.extensions.push({
        async afterUnloadDocument({ instance }) {
          if (instance.getDocumentsCount() === 0) resolve();
        },
      });
      if (this.hocuspocus.getDocumentsCount() === 0) resolve();
      this.hocuspocus.closeConnections();
      this.hocuspocus.flushPendingStores();
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        console.warn(
          `[collab] ${this.hocuspocus.getDocumentsCount()} document(s) still unloading after ${timeoutMs} ms; shutting down anyway.`,
        );
        resolve();
      }, timeoutMs);
    });

    try {
      await Promise.race([drained, expired]);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The minimal socket surface Hocuspocus needs (its own WebSocketLike). */
interface WebSocketLike {
  send(data: string | ArrayBufferLike | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}
