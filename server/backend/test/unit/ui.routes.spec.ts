import { afterAll, describe, expect, it } from 'bun:test';
import { SearchService } from '../../src/app/search/search.service.js';
import { createUiApp } from '../../src/ui/ui.routes.js';
import { testNoesis } from './test-noesis.js';

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
