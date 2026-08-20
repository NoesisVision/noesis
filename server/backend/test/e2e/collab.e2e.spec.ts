import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import * as Y from 'yjs';
import type { DatabaseService } from '../../src/database/database.service.js';
import {
  type CollabSocketData,
  DesignDocCollabService,
} from '../../src/design-docs/design-doc-collab.service.js';
import {
  projectState,
  projectYDoc,
} from '../../src/design-docs/design-doc-editor.server.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from '../unit/test-db.js';

// The /collab surface end to end on Bun: seed once server-side, a client
// syncs into the populated document, edits flow back through the debounced
// store hook into the graph, and the projection cache follows (decision 53).

let db: DatabaseService;
let repository: DesignDocsRepository;
let service: DesignDocsService;
let collab: DesignDocCollabService;
let server: ReturnType<typeof Bun.serve<CollabSocketData>>;
let url: string;

beforeAll(async () => {
  db = await sharedTestDatabase();
  repository = new DesignDocsRepository(db);
  service = new DesignDocsService(repository);
  collab = new DesignDocCollabService(repository, { mode: 'disabled' });
  server = Bun.serve<CollabSocketData>({
    port: 0,
    fetch(request, srv) {
      const { pathname } = new URL(request.url);
      if (pathname === '/collab' || pathname.startsWith('/collab/')) {
        return collab.upgrade(request, srv);
      }
      return new Response('not collab', { status: 404 });
    },
    websocket: collab.websocket,
  });
  url = `ws://localhost:${server.port}/collab`;
});

afterAll(async () => {
  await collab.close();
  await server.stop(true);
});

afterEach(async () => {
  await collab.close();
  await resetGraph();
});

async function seededDocumentId(): Promise<string> {
  const project = await new ProjectsRepository(db).create('Clinic');
  if (project === null) throw new Error('project creation failed');
  const summary = await service.create(project.id, designDocFixture);
  return summary.id;
}

function connect(name: string): {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  synced: Promise<void>;
  refused: Promise<string>;
} {
  const doc = new Y.Doc();
  let resolveSynced: () => void;
  let resolveRefused: (reason: string) => void;
  const synced = new Promise<void>((resolve) => {
    resolveSynced = resolve;
  });
  const refused = new Promise<string>((resolve) => {
    resolveRefused = resolve;
  });
  const provider = new HocuspocusProvider({
    url,
    name,
    document: doc,
    // Outside a browser the provider does not pick up the global WebSocket.
    ...({ WebSocketPolyfill: WebSocket } as object),
    onSynced: () => resolveSynced(),
    onAuthenticationFailed: ({ reason }) => resolveRefused(reason),
  });
  return { doc, provider, synced, refused };
}

const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);

describe('design-doc collab (e2e)', () => {
  it('syncs a client into the seeded document, never an empty one', async () => {
    const id = await seededDocumentId();
    const { doc, provider, synced } = connect(id);

    await timeout(synced, 5000);
    const projected = projectYDoc(doc);
    expect(projected).toEqual({ ...designDocFixture, id });

    provider.destroy();
  });

  it('stores an edit back to the graph and refreshes the projection cache', async () => {
    const id = await seededDocumentId();
    const { doc, provider, synced } = connect(id);
    await timeout(synced, 5000);

    // Edit the shared document the way any Yjs client would; the sidecar is
    // the smallest safely-editable structure without a full editor here.
    const sidecarMap = doc.getMap('design-doc-sidecar');
    const sidecar = JSON.parse(sidecarMap.get('json') as string) as {
      name: string;
    };
    sidecar.name = 'Appointment booking v2';
    sidecarMap.set('json', JSON.stringify(sidecar));

    // Disconnecting the last client makes Hocuspocus flush the store hooks.
    await new Promise((resolve) => setTimeout(resolve, 200));
    provider.destroy();
    await timeout(
      (async () => {
        for (let i = 0; i < 50; i++) {
          const row = await repository.findById(id);
          if (row !== null && row.name === 'Appointment booking v2') return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error('projection cache never refreshed');
      })(),
      6000,
    );

    const state = await repository.findState(id);
    expect(state).not.toBeNull();
    if (state === null) throw new Error('unreachable');
    expect(projectState(state).name).toBe('Appointment booking v2');
  });

  it('flushes a pending store on shutdown, with the client still attached', async () => {
    const id = await seededDocumentId();
    const { doc, provider, synced } = connect(id);
    await timeout(synced, 5000);

    const sidecarMap = doc.getMap('design-doc-sidecar');
    const sidecar = JSON.parse(sidecarMap.get('json') as string) as {
      name: string;
    };
    sidecar.name = 'Flushed on shutdown';
    sidecarMap.set('json', JSON.stringify(sidecar));

    // Long enough for the edit to reach the server and start its debounce,
    // far short of the debounce firing on its own. Nothing disconnects here:
    // the shutdown path is the only thing that can persist this edit, which
    // is exactly the case a container stop lands on.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await collab.close();

    const state = await repository.findState(id);
    expect(state).not.toBeNull();
    if (state === null) throw new Error('unreachable');
    expect(projectState(state).name).toBe('Flushed on shutdown');

    provider.destroy();
  });

  it('refuses a document that does not exist', async () => {
    const { provider, refused } = connect('no-such-document');
    expect(await timeout(refused, 5000)).toBe('permission-denied');
    provider.destroy();
  });
});
