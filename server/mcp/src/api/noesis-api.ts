import { hc } from 'hono/client';
import { decodeError } from '#backend/adapters/in/ui/error-body';
import type { AppType } from '#backend/boot/app.types';
import { BackendError } from '#mcp/backend/backend-error';

/** Where the `/ui` surface answers for now. */
export interface ApiTarget {
  /** e.g. `http://127.0.0.1:4321`. */
  origin: string;
  /** It went away mid-call, or is going: the next call finds it again. */
  lost(): void;
}

/**
 * The `/ui` surface, as the frontend's `api` client reads it: a method
 * answers the body of a successful response, and an error answer throws the
 * domain error it was encoded from, which `logged` answers in-band.
 */
export type NoesisApi = JsonClient<ReturnType<typeof hc<AppType>>>;

/** Only its path is kept: each request goes to wherever `target` says. */
const PLACEHOLDER_ORIGIN = 'http://noesis.invalid';

export function noesisApi(target: () => Promise<ApiTarget>): NoesisApi {
  return jsonClient(
    hc<AppType>(`${PLACEHOLDER_ORIGIN}/ui`, { fetch: forwardTo(target) }),
  );
}

/**
 * A request that fails in flight is never repeated: the create and add
 * routes are not idempotent, and a write that landed would be made twice.
 */
function forwardTo(target: () => Promise<ApiTarget>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const current = await target();
    const requested = new URL(input instanceof Request ? input.url : input);
    const url = new URL(requested.pathname + requested.search, current.origin);
    let response: Response;
    let body: ArrayBuffer;
    try {
      response = await fetch(url, input instanceof Request ? input : init);
      // Read whole here, so a connection dropped mid-body fails as the call.
      body = await response.arrayBuffer();
    } catch (error) {
      current.lost();
      throw BackendError.outcomeUnknown(String(error));
    }
    if (response.status === 503) {
      current.lost();
      throw BackendError.shuttingDown();
    }
    if (!response.ok) throw decodeError(response.status, jsonOf(body));
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  }) as typeof fetch;
}

function jsonOf(body: ArrayBuffer): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    return null;
  }
}

// The frontend's `jsonClient` (`server/frontend/src/shared/api/client.ts`),
// which it cannot share: the frontend imports nothing of the backend's at
// runtime, and this workspace nothing of the frontend's.

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

type JsonClient<T> = {
  [K in keyof T]: K extends HttpMethod
    ? T[K] extends (...args: infer Args) => Promise<infer Res>
      ? (...args: Args) => Promise<K extends '$head' ? null : ResponseData<Res>>
      : T[K]
    : K extends `$${string}`
      ? T[K]
      : JsonClient<T[K]>;
};

const HTTP_METHODS = new Set<string>([
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
      const value: unknown = Reflect.get(target, property, receiver);
      if (
        typeof property === 'string' &&
        HTTP_METHODS.has(property) &&
        typeof value === 'function'
      ) {
        return async (...args: unknown[]) => {
          const response = (await Reflect.apply(
            value,
            target,
            args,
          )) as Response;
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
