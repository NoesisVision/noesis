import { describe, expect, it } from 'bun:test';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { InboxRepository } from '../../src/inbox/inbox.repository.js';
import { InboxService } from '../../src/inbox/inbox.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { ProjectsService } from '../../src/projects/projects.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { createUiApp } from '../../src/ui/ui.routes.js';
import { sharedTestDatabase } from './test-db.js';

const db = await sharedTestDatabase();

describe('ui routes', () => {
  const app = createUiApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    authModule: { mode: 'disabled' },
    projectsService: new ProjectsService(new ProjectsRepository(db)),
    designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
    inboxService: new InboxService(new InboxRepository(db)),
    repoAccess: null,
  });

  it('returns the greeting', async () => {
    const res = await app.request('/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello World!');
  });

  it('lists the local account as the whole roster in disabled auth mode', async () => {
    const res = await app.request('/accounts');
    expect(res.status).toBe(200);
    const { accounts } = (await res.json()) as {
      accounts: { id: string; login: string; name: string }[];
    };
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.login).toBe('local');
  });
});
