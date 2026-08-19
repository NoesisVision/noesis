import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client';

// The account shape is inferred straight from the server's `/ui/me` handler
// through `AppType` — the same route that answers it defines its type, so a
// field renamed on the server stops this app from compiling.
export type MeResponse = InferResponseType<typeof client.ui.me.$get, 200>;
export type Account = MeResponse['account'];
export type Installation = MeResponse['installations'][number];

/** `/ui/me` answered 401: there is no session, so the shell must not render. */
export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in.');
    this.name = 'UnauthenticatedError';
  }
}

export const meQueryOptions = queryOptions({
  queryKey: ['ui', 'me'],
  queryFn: async (): Promise<MeResponse> => {
    const response = await client.ui.me.$get();
    if (response.status === 401) throw new UnauthenticatedError();
    if (!response.ok) {
      throw new Error(`/ui/me failed with status ${response.status}`);
    }
    return response.json();
  },
  // Signed out is an answer, not a hiccup: retrying it just delays the
  // redirect to /login.
  retry: false,
  staleTime: 5 * 60 * 1000,
});

/**
 * What the server will accept a sign-in from, asked before there is a session.
 * In `local` mode it also names the identities to offer — that is the whole
 * reason the sign-in page has to ask rather than assume GitHub.
 */
export type AuthMode = InferResponseType<typeof client.auth.mode.$get, 200>;

export const authModeQueryOptions = queryOptions({
  queryKey: ['auth', 'mode'],
  queryFn: async (): Promise<AuthMode> => {
    const response = await client.auth.mode.$get();
    if (!response.ok) {
      throw new Error(`/auth/mode failed with status ${response.status}`);
    }
    return response.json();
  },
  // A deployment cannot change its auth mode without restarting, and this app
  // does not outlive a restart.
  staleTime: Number.POSITIVE_INFINITY,
});

export async function signOut(): Promise<void> {
  await client.auth.logout.$post();
}

/** The sign-in flow is a navigation, not a fetch — these are hrefs, not calls. */
export const LOGIN_HREF = '/auth/login';

/** Local mode only: sign in as one named fake identity. */
export function localLoginHref(login: string): string {
  return `${LOGIN_HREF}?as=${encodeURIComponent(login)}`;
}
export const INSTALL_HREF = '/auth/install';
