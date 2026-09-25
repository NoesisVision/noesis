import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  designDocById,
  designDocsList,
} from '../src/features/design-docs/design-docs.api';
import { ApiError } from '../src/shared/api/client';
import {
  designDocDetailFixture,
  designDocFixture,
  designDocPayloadFixture,
} from './fixtures/design-doc.fixture';

const fetchSpy = spyOn(globalThis, 'fetch');
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
afterEach(() => {
  fetchSpy.mockReset();
  cache.clear();
});
afterAll(() => fetchSpy.mockRestore());

it('requests the change-scoped list and forwards cancellation', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ designDocs: [] }));
  expect(
    await cache.fetchQuery(designDocsList('2026-01-01-scheduling')),
  ).toEqual([]);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/2026-01-01-scheduling/design-docs',
  );
  expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it('rebuilds the outline beside the document, and isolates changes', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json(designDocPayloadFixture));
  expect(
    await cache.fetchQuery(
      designDocById('2026-01-01-scheduling', designDocFixture.id),
    ),
  ).toEqual(designDocDetailFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    `/ui/changes/2026-01-01-scheduling/design-docs/${designDocFixture.id}`,
  );
  expect(
    cache.getQueryData(
      designDocById('2026-01-02-billing', designDocFixture.id).queryKey,
    ),
  ).toBeUndefined();
});

it('preserves a missing document as an error', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'not_found' }, { status: 404 }),
  );
  await expect(
    cache.fetchQuery(designDocById('2026-01-01-scheduling', 'missing')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(
      designDocById('2026-01-01-scheduling', 'missing').queryKey,
    ),
  ).toBeUndefined();
});

it('does not turn a failed list request into an empty list', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'unavailable' }, { status: 503 }),
  );
  await expect(
    cache.fetchQuery(designDocsList('2026-01-01-scheduling')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(designDocsList('2026-01-01-scheduling').queryKey),
  ).toBeUndefined();
});
