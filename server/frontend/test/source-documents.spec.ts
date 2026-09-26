import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { SourceDocumentId } from '#backend/app/changes/source-document-id.ts';
import { sourceDocumentById } from '../src/features/source-documents/source-documents.api';
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
  id: '2026-01-01-payment-retry-policy' as SourceDocumentId,
  title: 'Payment retry policy',
  date: '2026-09-12',
  content: 'Retry twice, then stop.',
};

it('unwraps the selected document and isolates documents between changes', async () => {
  fetchSpy.mockResolvedValueOnce(Response.json({ document: documentFixture }));
  expect(
    await cache.fetchQuery(
      sourceDocumentById(
        '2026-01-01-scheduling',
        '2026-01-01-payment-retry-policy',
      ),
    ),
  ).toEqual(documentFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/2026-01-01-scheduling/source-documents/2026-01-01-payment-retry-policy',
  );
  expect(
    cache.getQueryData(
      sourceDocumentById(
        '2026-01-02-billing',
        '2026-01-01-payment-retry-policy',
      ).queryKey,
    ),
  ).toBeUndefined();
});

it('preserves a missing document as an error', async () => {
  fetchSpy.mockResolvedValueOnce(
    Response.json({ error: 'not_found' }, { status: 404 }),
  );
  await expect(
    cache.fetchQuery(sourceDocumentById('2026-01-01-scheduling', 'missing')),
  ).rejects.toBeInstanceOf(ApiError);
  expect(
    cache.getQueryData(
      sourceDocumentById('2026-01-01-scheduling', 'missing').queryKey,
    ),
  ).toBeUndefined();
});
