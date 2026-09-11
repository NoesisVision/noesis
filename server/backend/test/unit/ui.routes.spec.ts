import { afterAll, describe, expect, it } from 'bun:test';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { createUiApp } from '../../src/ui/ui.routes.js';
import { testNoesis } from './test-noesis.js';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('ui routes', () => {
  const app = createUiApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
  });

  it('returns the greeting', async () => {
    const res = await app.request('/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('serves the surface unguarded — no session, no 401', async () => {
    const res = await app.request('/changes');
    expect(res.status).toBe(200);
  });
});
