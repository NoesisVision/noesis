import { afterAll, beforeAll, expect, it } from 'bun:test';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import * as Y from 'yjs';
import type { DatabaseService } from '../../src/database/database.service.js';
import {
  type CollabSocketData,
  DesignDocCollabService,
} from '../../src/design-docs/design-doc-collab.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from '../unit/test-db.js';

let db: DatabaseService;
let collab: DesignDocCollabService;
let server: ReturnType<typeof Bun.serve<CollabSocketData>>;
let url: string;

beforeAll(async () => {
  db = await sharedTestDatabase();
  const repository = new DesignDocsRepository(db);
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
  await resetGraph();
});

function connect(name: string) {
  const doc = new Y.Doc();
  let resolveSynced: () => void;
  const synced = new Promise<void>((r) => {
    resolveSynced = r;
  });
  const provider = new HocuspocusProvider({
    url,
    name,
    document: doc,
    ...({ WebSocketPolyfill: WebSocket } as object),
    onSynced: () => resolveSynced(),
  });
  return { doc, provider, synced };
}

it('broadcasts an edit from one live client to another', async () => {
  const project = await new ProjectsRepository(db).create('Clinic');
  if (project === null) throw new Error('project creation failed');
  const service = new DesignDocsService(new DesignDocsRepository(db));
  const { id } = await service.create(project.id, designDocFixture);

  const a = connect(id);
  const b = connect(id);
  await Promise.all([a.synced, b.synced]);

  const map = a.doc.getMap('design-doc-sidecar');
  map.set('broadcast-probe', 'hello-from-a');

  const seen = await new Promise<string | undefined>((resolve) => {
    const check = () => {
      const v = b.doc.getMap('design-doc-sidecar').get('broadcast-probe');
      if (v !== undefined) resolve(v as string);
    };
    b.doc.on('update', check);
    check();
    setTimeout(() => resolve(undefined), 4000);
  });

  a.provider.destroy();
  b.provider.destroy();
  expect(seen).toBe('hello-from-a');
}, 15000);
