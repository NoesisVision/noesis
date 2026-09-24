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
  id: '2026-01-01-payment-retry-policy',
  title: 'Payment retry policy',
  date: '2026-09-12',
  content: 'Retry twice, then stop.',
};

it('requests the change-scoped list and forwards cancellation', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ documents: [] }));
  expect(
    await cache.fetchQuery(documentsList('2026-01-01-scheduling')),
  ).toEqual([]);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/2026-01-01-scheduling/documents',
  );
  expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});

it('makes no request without a change open', async () => {
  expect(await cache.fetchQuery(documentsList(null))).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('unwraps the selected document and isolates documents between changes', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ document: documentFixture }));
  expect(
    await cache.fetchQuery(
      documentById('2026-01-01-scheduling', '2026-01-01-payment-retry-policy'),
    ),
  ).toEqual(documentFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/2026-01-01-scheduling/documents/2026-01-01-payment-retry-policy',
  );
  expect(
    cache.getQueryData(
      documentById('2026-01-02-billing', '2026-01-01-payment-retry-policy')
        .queryKey,
    ),
  ).toBeUndefined();
});

it('preserves a missing document as an error', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'not_found' }, { status: 404 }),
  );
  await expect(
    cache.fetchQuery(documentById('2026-01-01-scheduling', 'missing')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(
      documentById('2026-01-01-scheduling', 'missing').queryKey,
    ),
  ).toBeUndefined();
});

it('does not turn a failed list request into an empty list', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'unavailable' }, { status: 503 }),
  );
  await expect(
    cache.fetchQuery(documentsList('2026-01-01-scheduling')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(documentsList('2026-01-01-scheduling').queryKey),
  ).toBeUndefined();
});
