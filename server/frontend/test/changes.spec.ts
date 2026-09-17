import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  ChangeNotFoundError,
  changeById,
  changesList,
  createChange,
  DuplicateChangeError,
} from '../src/api/changes';
import { ApiError, api } from '../src/api/client';

const fetchSpy = spyOn(globalThis, 'fetch');
afterAll(() => fetchSpy.mockRestore());
let cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => {
  fetchSpy.mockReset();
  cache.clear();
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const input = { name: 'Retry', key: '', type: 'feature' as const };

describe('change API errors', () => {
  it('resolves an empty list only on success and passes the abort signal', async () => {
    fetchSpy.mockResolvedValueOnce(Response.json({ changes: [] }));
    expect(await cache.fetchQuery(changesList)).toEqual([]);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get('x-request-id')).toBeTruthy();
  });

  it('puts HTTP failures in Query error state without caching an empty list', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({ error: 'unavailable' }, { status: 503 }),
    );
    await expect(cache.fetchQuery(changesList)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(cache.getQueryState(changesList.queryKey)?.status).toBe('error');
    expect(cache.getQueryData(changesList.queryKey)).toBeUndefined();
  });

  it('maps 404 to not found', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({ error: 'change_not_found' }, { status: 404 }),
    );
    await expect(
      cache.fetchQuery(changeById('missing')),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
  });

  it('preserves network failures instead of reporting not found', async () => {
    const error = new TypeError('Failed to fetch');
    fetchSpy.mockRejectedValueOnce(error);
    await expect(cache.fetchQuery(changeById('retry'))).rejects.toBe(error);
  });

  it('preserves server failures instead of reporting not found', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json({ error: 'unavailable' }, { status: 503 }),
    );
    await expect(cache.fetchQuery(changeById('retry'))).rejects.toMatchObject({
      status: 503,
    });
  });

  it.each(['slug', 'key'] as const)(
    'maps a duplicate %s to a field error',
    async (field) => {
      fetchSpy.mockResolvedValueOnce(
        Response.json({ error: 'duplicate_change', field }, { status: 409 }),
      );
      await expect(createChange(input)).rejects.toBeInstanceOf(
        DuplicateChangeError,
      );
    },
  );

  it('preserves unrecognized conflicts', async () => {
    fetchSpy.mockResolvedValueOnce(
      Response.json(
        { error: 'duplicate_change', field: 'unexpected' },
        { status: 409 },
      ),
    );
    await expect(createChange(input)).rejects.toBeInstanceOf(ApiError);
  });

  it('retains HTTP status when an error body is malformed JSON', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{', {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(createChange(input)).rejects.toMatchObject({
      status: 502,
      body: null,
    });
  });

  it('returns the created change on success', async () => {
    const change = {
      ...input,
      slug: 'retry',
      status: 'discovery' as const,
      created_at: '2026-09-14',
      description: '',
    };
    fetchSpy.mockResolvedValueOnce(Response.json({ change }, { status: 201 }));
    expect(await createChange(input)).toEqual(change);
  });
});

it('unwraps nested routes and handles empty DELETE responses', async () => {
  fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const result = await api.changes[':change']['design-docs'][':id'].$delete({
    param: { change: 'retry', id: 'doc-1' },
  });
  expect(result).toBeNull();
  expect(fetchSpy.mock.calls[0]?.[0]).toBe(
    '/ui/changes/retry/design-docs/doc-1',
  );
});

it('rejects malformed success JSON', async () => {
  fetchSpy.mockResolvedValueOnce(
    new Response('{', { headers: { 'content-type': 'application/json' } }),
  );
  await expect(api.changes.$get()).rejects.toBeInstanceOf(SyntaxError);
});
