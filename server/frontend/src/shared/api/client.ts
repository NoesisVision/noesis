import { hc } from 'hono/client';
import { uiLogger } from '#/shared/logging.ts';
import type { AppType } from '#backend/boot/app.types.ts';

const log = uiLogger('api');

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    // The surfaces answer `{ error: '<code>' }`; the code names the failure
    // for whoever catches this. `describeFailure` turns it into the sentence
    // a page shows, so nothing renders this message.
    super(errorText(body) ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function errorText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { error } = body as { error?: unknown };
  return typeof error === 'string' && error.trim() !== '' ? error : null;
}

const customFetch = (async (
  input: string | Request | URL,
  init?: RequestInit,
  _env?: unknown,
  _executionCtx?: unknown,
): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const path =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET');
  const started = performance.now();

  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value);
  });
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  headers.set('x-request-id', requestId);
  const res = await fetch(input, { ...init, headers });

  const durationMs = Math.round(performance.now() - started);

  if (!res.ok) {
    const body: unknown = res.headers
      .get('content-type')
      ?.includes('application/json')
      ? await res.json().catch(() => null)
      : null;

    log.warn('{method} {path} failed with {status} in {durationMs} ms', {
      method,
      path,
      status: res.status,
      durationMs,
      requestId,
      body,
    });

    throw new ApiError(res.status, body);
  }

  log.debug('{method} {path} {status} in {durationMs} ms', {
    method,
    path,
    status: res.status,
    durationMs,
    requestId,
  });

  return res;
}) as typeof fetch;

/** The `/ui` surface; read a call with `parseResponse` from `hono/client`. */
export const api = hc<AppType>('/ui', { fetch: customFetch });
