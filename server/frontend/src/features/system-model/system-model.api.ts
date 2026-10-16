import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';

const NEWEST_KEY = ['system-models', 'newest'] as const;

/** The model scanned last; `null` before the first scan. */
export const newestSystemModel = queryOptions({
  queryKey: NEWEST_KEY,
  queryFn: async ({ signal }) => {
    const data = await api['system-models'].newest.$get(
      {},
      { init: { signal } },
    );
    return data.systemModel;
  },
});

/** Scans the code with the server's scanner; the model found becomes the newest. */
export function useScanSystemModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api['system-models'].$post()).systemModel,
    onSuccess: (systemModel) =>
      queryClient.setQueryData(NEWEST_KEY, systemModel),
  });
}
