import { afterAll, describe, expect, it } from 'bun:test';
import { SearchService } from '#backend/app/search/search.service';
import { createApp } from '#backend/boot/app';
import { testNoesis } from './test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

describe('app', () => {
  const app = createApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });

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

  it("refuses a write another site's page sends as a form", async () => {
    const res = await app.request('http://127.0.0.1:3000/ui/changes', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
      body: JSON.stringify({ name: 'Planted', type: 'chore' }),
    });

    expect(res.status).toBe(403);
    expect(await t.changesService.list()).toEqual([]);
  });

  it('takes a write the page sends from its own origin', async () => {
    const res = await app.request('http://127.0.0.1:3000/ui/changes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:3000',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ name: 'From the page', type: 'chore' }),
    });

    expect(res.status).toBe(201);
  });

  it('takes a removal the page sends, and refuses one without a page behind it', async () => {
    const change = await t.createChange('2026-01-01-booking');
    const url = `http://127.0.0.1:3000/ui/changes/${change}/documents/2026-01-01-notes`;

    const fromPage = await app.request(url, {
      method: 'DELETE',
      headers: {
        origin: 'http://127.0.0.1:3000',
        'sec-fetch-site': 'same-origin',
      },
    });
    const bare = await app.request(url, { method: 'DELETE' });

    // Past the guards: the change holds no such document.
    expect(fromPage.status).toBe(404);
    expect(bare.status).toBe(403);
  });

  it('mints a request id when none arrives, on every surface', async () => {
    for (const path of ['/ui/changes', '/internal/health']) {
      const id = (await app.request(path)).headers.get('x-request-id');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
