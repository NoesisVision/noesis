import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '#/shared/api/client.ts';
import type { SystemModelSummary } from '#backend/app/system-model/system-model-summary.ts';

export type { SystemModelSummary };

/** The scan stored last, counted; null before the first scan. */
export const newestSystemModel = queryOptions({
  queryKey: ['system-model', 'newest'] as const,
  queryFn: async ({ signal }): Promise<SystemModelSummary | null> => {
    const data = await api['system-model'].$get({}, { init: { signal } });
    return data.systemModel;
  },
});

/**
 * Runs a scan with the scanner the repository configures. The server stores
 * the model and the newest-scan query is refreshed from what it answered.
 */
export function useScanSystemModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SystemModelSummary> => {
      const data = await api['system-model'].scan.$post();
      return data.systemModel;
    },
    onSuccess: (systemModel) => {
      queryClient.setQueryData(newestSystemModel.queryKey, systemModel);
    },
  });
}
