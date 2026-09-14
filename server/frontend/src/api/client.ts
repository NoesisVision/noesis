import { hc } from 'hono/client';
import { uiLogger } from '#/logging';
import type { AppType } from '#/server/app.types.ts';

const log = uiLogger('api');

/** Error returned by the JSON API wrapper. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    // The surfaces answer `{ error }`: a code (`duplicate_change`) or, on a
    // 400, zod's prettified issues. Either reads better than the status.
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

type HttpMethod =
  | '$get'
  | '$post'
  | '$put'
  | '$patch'
  | '$delete'
  | '$options'
  | '$head';

type ResponseData<T> = T extends { ok: false }
  ? never
  : T extends { status: 204 | 205 }
    ? null
    : T extends { json: () => Promise<infer Data> }
      ? Data
      : never;

/** Keep route arguments and helpers while unwrapping successful responses. */
type JsonClient<T> = {
  [K in keyof T]: K extends HttpMethod
    ? T[K] extends (...args: infer Args) => Promise<infer Res>
      ? (...args: Args) => Promise<K extends '$head' ? null : ResponseData<Res>>
      : T[K]
    : K extends `$${string}`
      ? T[K]
      : JsonClient<T[K]>;
};

const httpMethods = new Set<string>([
  '$get',
  '$post',
  '$put',
  '$patch',
  '$delete',
  '$options',
  '$head',
]);

function jsonClient<T extends object>(client: T): JsonClient<T> {
  return new Proxy(client, {
    get(target, property, receiver) {
      // Hono routes are proxies too; they must not become promise-like.
      if (property === 'then') return undefined;
      const value = Reflect.get(target, property, receiver);
      if (
        typeof property === 'string' &&
        httpMethods.has(property) &&
        typeof value === 'function'
      ) {
        return async (...args: unknown[]) => {
          const response: Response = await Reflect.apply(value, target, args);
          if (
            property === '$head' ||
            response.status === 204 ||
            response.status === 205
          ) {
            return null;
          }
          return response.json();
        };
      }
      // Leave Hono helpers such as $url untouched.
      if (
        typeof property === 'string' &&
        !property.startsWith('$') &&
        value != null &&
        (typeof value === 'object' || typeof value === 'function')
      ) {
        return jsonClient(value);
      }
      return value;
    },
  }) as JsonClient<T>;
}

/** Same-origin RPC client returning JSON and throwing on HTTP failures. */
export const api = jsonClient(hc<AppType>('/ui', { fetch: customFetch }));
