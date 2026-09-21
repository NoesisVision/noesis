import { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
}

export function getContext(): RouterContext {
  return { queryClient: new QueryClient() };
}
