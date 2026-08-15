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

export async function signOut(): Promise<void> {
  await client.auth.logout.$post();
}

/** The sign-in flow is a navigation, not a fetch — these are hrefs, not calls. */
export const LOGIN_HREF = '/auth/login';
export const INSTALL_HREF = '/auth/install';
