import type { AppType } from 'backend/client';
import { hc } from 'hono/client';

// The SPA's guard owns /ui/me: a 401 there is the expected signed-out answer
// and is turned into a router redirect. Everywhere else a 401 means the
// session died mid-session, and the view that asked has no way to recover — so
// the interceptor takes the browser to /login rather than letting the failure
// surface as a broken panel.
const GUARD_PATH = '/ui/me';

async function fetchWithSessionGuard(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const url = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    window.location.origin,
  );
  if (url.pathname !== GUARD_PATH && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
  return response;
}

// Typed RPC client inferred from the server's route tree: path, method,
// params, and response types all come from `AppType`. Import ONLY types from
// the `server` package (decision 28) — a value import would pull server code
// into the browser bundle.
export const client = hc<AppType>(window.location.origin, {
  fetch: fetchWithSessionGuard,
});
