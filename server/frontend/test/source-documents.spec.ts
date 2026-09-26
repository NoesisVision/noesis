import { afterAll, afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { SourceDocumentId } from '#backend/app/changes/model/source-document-id.ts';
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
  id: '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1c' as SourceDocumentId,
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
        '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1c',
      ),
    ),
  ).toEqual(documentFixture);
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/2026-01-01-scheduling/source-documents/0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1c',
  );
  expect(
    cache.getQueryData(
      sourceDocumentById(
        '2026-01-02-billing',
        '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1c',
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
