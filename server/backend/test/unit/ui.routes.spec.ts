import { afterAll, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { testNoesis } from './test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('ui routes', () => {
  const app = createUiApp(t);

  it('has no greeting any more', async () => {
    expect((await app.request('/hello')).status).toBe(404);
  });

  it('serves the surface unguarded — no session, no 401', async () => {
    const res = await app.request('/changes');
    expect(res.status).toBe(200);
  });

  it('answers an unforeseen failure as JSON, not a bare 500 page', async () => {
    const res = await createUiApp({
      ...t,
      search: { handle: () => Promise.reject(new Error('disk on fire')) },
    }).request('/search?q=x');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });
});
