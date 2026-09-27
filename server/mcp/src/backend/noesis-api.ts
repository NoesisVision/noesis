import { hc } from 'hono/client';
import { decodeError } from '#backend/adapters/in/ui/error-body';
import type { AppType } from '#backend/adapters/in/ui/ui.routes';

/**
 * A call the service gave no answer to decode: it was shutting down, or the
 * connection failed in flight and whether the call took effect is unknown.
 */
export class ServiceCallError extends Error {
  readonly kind: 'shutting_down' | 'no_answer';

  private constructor(kind: ServiceCallError['kind'], message: string) {
    super(message);
    this.name = 'ServiceCallError';
    this.kind = kind;
  }

  static shuttingDown(): ServiceCallError {
    return new ServiceCallError(
      'shutting_down',
      'The Noesis service was shutting down, so nothing was written.',
    );
  }

  static noAnswer(reason: string): ServiceCallError {
    return new ServiceCallError(
      'no_answer',
      `The call reached the Noesis service but no answer came back (${reason}), so whether it took effect is unknown.`,
    );
  }
}

/** Where the `/ui` surface answers for now. */
export interface ApiTarget {
  /** e.g. `http://127.0.0.1:4321`. */
  origin: string;
  /** It went away mid-call, or is going: the next call finds it again. */
  lost(): void;
}

/**
 * The `/ui` surface, as the frontend's `api` client reads it: a call is read
 * with `parseResponse`, and an error answer throws the domain error it was
 * encoded from. The MCP tools call through here, from the shim to the daemon
 * or in-process in direct mode.
 */
export type NoesisApi = ReturnType<typeof hc<AppType>>;

/** Only its path is kept: each request goes to wherever `target` says. */
const PLACEHOLDER_ORIGIN = 'http://noesis.invalid';

export function noesisApi(target: () => Promise<ApiTarget>): NoesisApi {
  return hc<AppType>(`${PLACEHOLDER_ORIGIN}/ui`, { fetch: forwardTo(target) });
}

/**
 * A request that fails in flight is never repeated: the create and add
 * routes are not idempotent, and a write that landed would be made twice.
 */
function forwardTo(target: () => Promise<ApiTarget>): typeof fetch {
  // `hc` calls fetch with a URL and an init, never a `Request`.
  return (async (input: string | URL, init?: RequestInit) => {
    const current = await target();
    const requested = new URL(input);
    const url = new URL(requested.pathname + requested.search, current.origin);
    let response: Response;
    let body: string;
    try {
      response = await fetch(url, init);
      // Read whole here, so a connection dropped mid-body fails as the call.
      body = await response.text();
    } catch (error) {
      current.lost();
      throw ServiceCallError.noAnswer(String(error));
    }
    if (response.status === 503) {
      current.lost();
      throw ServiceCallError.shuttingDown();
    }
    if (!response.ok) throw decodeError(response.status, jsonOf(body));
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  }) as typeof fetch;
}

function jsonOf(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
