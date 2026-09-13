import { afterAll, describe, expect, it } from 'bun:test';
import { createApp } from '../../src/app.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { testNoesis } from './test-noesis.js';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('app', () => {
  const app = createApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
  });

  it('echoes an incoming x-request-id on the response', async () => {
    const res = await app.request('/ui/changes', {
      headers: { 'x-request-id': 'corr-42' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('corr-42');
  });

  it('mints a request id when none arrives, on every surface', async () => {
    for (const path of ['/ui/changes', '/internal/health']) {
      const id = (await app.request(path)).headers.get('x-request-id');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
