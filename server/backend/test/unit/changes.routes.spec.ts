import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createChangesApp } from '../../src/ui/changes/changes.routes.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

let t: TestNoesis;
let app: ReturnType<typeof createChangesApp>;

beforeEach(async () => {
  t = await testNoesis();
  app = createChangesApp({ changesService: t.changesService });
});

afterEach(() => t.cleanup());

const post = (body: unknown) =>
  app.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('ui changes routes', () => {
  it('creates a change directory and lists it', async () => {
    const created = await post({ slug: 'payment-retry' });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ change: { slug: 'payment-retry' } });

    const listed = await app.request('/');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      changes: [{ slug: 'payment-retry' }],
    });
    expect(await t.changesRepository.list()).toEqual(['payment-retry']);
  });

  it('409s a duplicate and 400s a slug that is not a directory name', async () => {
    await post({ slug: 'once' });

    const dup = await post({ slug: 'once' });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: 'duplicate_change' });

    expect((await post({ slug: 'Not A Slug' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });
});
