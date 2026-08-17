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

  /** Flush and drop every connection — part of graceful shutdown. */
  async close(): Promise<void> {
    await this.hocuspocus.closeConnections();
  }
}

/** The minimal socket surface Hocuspocus needs (its own WebSocketLike). */
interface WebSocketLike {
  send(data: string | ArrayBufferLike | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}
