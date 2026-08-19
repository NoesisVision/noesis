import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client } from '@/client';

// The comment-author / mention roster (design-doc phase 4): every account on
// the invite-gated instance. Shapes inferred from the server (decision 28).
export type AccountSummary = InferResponseType<
  typeof client.ui.accounts.$get,
  200
>['accounts'][number];

export const ACCOUNTS_KEY = ['ui', 'accounts'] as const;

export function accountsQueryOptions() {
  return queryOptions({
    queryKey: ACCOUNTS_KEY,
    queryFn: async (): Promise<AccountSummary[]> => {
      const response = await client.ui.accounts.$get();
      if (!response.ok) {
        throw new Error(`Could not load accounts (${response.status}).`);
      }
      return (await response.json()).accounts;
    },
    // The roster changes only when someone accepts an invite.
    staleTime: 5 * 60 * 1000,
  });
}
