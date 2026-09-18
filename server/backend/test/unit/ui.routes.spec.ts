import { afterAll, describe, expect, it } from 'bun:test';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import { testNoesis } from './test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('ui routes', () => {
  const app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
  });

  it('has no greeting any more', async () => {
    expect((await app.request('/hello')).status).toBe(404);
  });

  it('serves the surface unguarded — no session, no 401', async () => {
    const res = await app.request('/changes');
    expect(res.status).toBe(200);
  });
});
