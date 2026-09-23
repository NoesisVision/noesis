import { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  queryClient: QueryClient;
}

export function getContext(): RouterContext {
  return {
    queryClient: new QueryClient({
      defaultOptions: {
        queries: {
          // A failed read is the state of the page, not of the view: it is
          // thrown so the route's boundary draws it, and no view carries an
          // error branch. A refetch that fails over data already on screen is
          // not that, and must not replace a page that is working.
          throwOnError: (_error, query) => query.state.data === undefined,
        },
      },
    }),
  };
}
