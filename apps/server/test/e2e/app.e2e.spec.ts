import { describe, expect, it } from 'bun:test';
import { apiPath } from '@repo/local-contracts';
import { createApp } from '../../src/app.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';

// Route-surface assertions over the composed app. createApp takes only the
// deps the surfaces need — no DB boots here (its lifecycle is covered by the
// service specs and by static-ui.e2e.spec.ts, which spawns the real server).
describe('Route surfaces (e2e)', () => {
  const app = createApp({ greetingService: new GreetingService() });

  it('/ui/hello (GET) — ui surface', async () => {
    const res = await app.request('/ui/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
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
