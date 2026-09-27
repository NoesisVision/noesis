import { afterAll, describe, expect, it } from 'bun:test';
import { createApp } from '#backend/boot/app';
import { testAppOptions } from '../support/app-options';
import { testNoesis } from './test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('app', () => {
  const app = createApp(t, testAppOptions());

  it('echoes an incoming x-request-id on the response', async () => {
    const res = await app.request('/ui/changes', {
      headers: { 'x-request-id': 'corr-42' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('corr-42');
  });

  it('refuses a request naming another host, on every surface', async () => {
    for (const path of ['/ui/changes', '/internal/health']) {
      const res = await app.request(`http://evil.example${path}`);
      expect(res.status).toBe(403);
    }
  });

  it('answers the names the loopback listener is reached by', async () => {
    for (const host of ['localhost:3000', '127.0.0.1', '[::1]:3000']) {
      const res = await app.request(`http://${host}/internal/health`);
      expect(res.status).toBe(200);
    }
  });

  it('mints a request id when none arrives, on every surface', async () => {
    for (const path of ['/ui/changes', '/internal/health']) {
      const id = (await app.request(path)).headers.get('x-request-id');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('answers every surface with 503 once shutdown has begun', async () => {
    const draining = createApp(t, testAppOptions({ draining: () => true }));
    for (const path of ['/ui/changes', '/internal/attach']) {
      const res = await draining.request(path);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'shutting_down' });
    }
  });
});
