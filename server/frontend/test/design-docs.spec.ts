import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { designDocFixture } from '#backend/app/design-docs/design-doc.fixture.ts';
import {
  designDocById,
  designDocsList,
} from '../src/features/design-docs/design-docs.api';
import { ApiError } from '../src/shared/api/client';

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
  expect(await cache.fetchQuery(designDocsList('test-2'))).toEqual([]);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe('/ui/changes/test-2/design-docs');
  expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it('unwraps the selected document and isolates documents between changes', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ document: designDocFixture }));
  expect(
    await cache.fetchQuery(designDocById('test-2', 'doc-appointments')),
  ).toEqual(designDocFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/test-2/design-docs/doc-appointments',
  );
  expect(
    cache.getQueryData(designDocById('test', 'doc-appointments').queryKey),
  ).toBeUndefined();
});

it('preserves a missing document as an error', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'not_found' }, { status: 404 }),
  );
  await expect(
    cache.fetchQuery(designDocById('test-2', 'missing')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(designDocById('test-2', 'missing').queryKey),
  ).toBeUndefined();
});

it('does not turn a failed list request into an empty list', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'unavailable' }, { status: 503 }),
  );
  await expect(
    cache.fetchQuery(designDocsList('test-2')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(cache.getQueryData(designDocsList('test-2').queryKey)).toBeUndefined();
});
