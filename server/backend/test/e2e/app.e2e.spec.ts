import { afterAll, describe, expect, it } from 'bun:test';
import { apiPath } from '@repo/local-contracts';
import { createApp } from '../../src/app.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { testNoesis } from '../unit/test-noesis.js';

// Route-surface assertions over the composed app. A throwaway `.noesis/`
// backs the stateful services; everything else is the deps the surfaces need.
const t = await testNoesis();
afterAll(() => t.cleanup());

describe('Route surfaces (e2e)', () => {
  const app = createApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
  });

  it('/ui/hello (GET) — ui surface', async () => {
    const res = await app.request('/ui/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('/ui/search (GET) — ui surface', async () => {
    const res = await app.request('/ui/search?q=order');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
  });

  it(`/${apiPath('hello')} (GET) — api surface`, async () => {
    const res = await app.request(`/${apiPath('hello')}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
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
