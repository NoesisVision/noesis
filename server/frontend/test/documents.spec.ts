import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  documentById,
  documentsList,
} from '../src/features/documents/documents.api';
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

const documentFixture = {
  document_id: 'payment-retry-policy',
  title: 'Payment retry policy',
  date: '2026-09-12',
  content: 'Retry twice, then stop.',
};

it('requests the change-scoped list and forwards cancellation', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ documents: [] }));
  expect(await cache.fetchQuery(documentsList('test-2'))).toEqual([]);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe('/ui/changes/test-2/documents');
  expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it('makes no request without a change open', async () => {
  expect(await cache.fetchQuery(documentsList(null))).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('unwraps the selected document and isolates documents between changes', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ document: documentFixture }));
  expect(
    await cache.fetchQuery(documentById('test-2', 'payment-retry-policy')),
  ).toEqual(documentFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/test-2/documents/payment-retry-policy',
  );
  expect(
    cache.getQueryData(documentById('test', 'payment-retry-policy').queryKey),
  ).toBeUndefined();
});

it('preserves a missing document as an error', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'not_found' }, { status: 404 }),
  );
  await expect(
    cache.fetchQuery(documentById('test-2', 'missing')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(documentById('test-2', 'missing').queryKey),
  ).toBeUndefined();
});

it('does not turn a failed list request into an empty list', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'unavailable' }, { status: 503 }),
  );
  await expect(
    cache.fetchQuery(documentsList('test-2')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(cache.getQueryData(documentsList('test-2').queryKey)).toBeUndefined();
});
