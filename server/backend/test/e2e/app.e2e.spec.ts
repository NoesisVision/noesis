import { afterAll, describe, expect, it } from 'bun:test';
import { SearchService } from '#backend/app/search/search.service';
import { createApp } from '#backend/boot/app';
import { testNoesis } from '../unit/test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('Route surfaces (e2e)', () => {
  const app = createApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });

  it('/ui/changes (GET) — ui surface', async () => {
    const res = await app.request('/ui/changes');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ changes: [] });
  });

  it('/ui/search (GET) — ui surface', async () => {
    const res = await app.request('/ui/search?q=order');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  it('/api (GET) — no api surface any more, the agent comes over MCP', async () => {
    const res = await app.request('/api/hello');
    expect(res.status).toBe(404);
  });

  it('/internal/health (GET) — internal surface', async () => {
    const res = await app.request('/internal/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('/ (GET) — no route at the root', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(404);
  });
});
