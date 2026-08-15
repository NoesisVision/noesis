import { describe, expect, it } from 'bun:test';
import { apiPath } from '@repo/local-contracts';
import { createApp } from '../../src/app.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { ProjectsService } from '../../src/projects/projects.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { sharedTestDatabase } from '../unit/test-db.js';

// Route-surface assertions over the composed app. The shared in-memory DB
// backs the projects service; everything else is the deps the surfaces need.
const db = await sharedTestDatabase();

describe('Route surfaces (e2e)', () => {
  const app = createApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    authModule: { mode: 'disabled' },
    projectsService: new ProjectsService(new ProjectsRepository(db)),
    repoAccess: null,
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
