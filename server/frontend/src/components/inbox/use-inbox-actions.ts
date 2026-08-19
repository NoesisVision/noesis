import { useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/client';
import { inboxErrorMessage, inboxKey } from '@/lib/inbox';

export interface CaptureInput {
  kind: 'note' | 'transcript';
  title: string;
  body: string;
  origin: string;
}

/**
 * Every inbox write, as mutations that refetch the list on success. Refusal
 * bodies become the sentences the panels show (`Error.message`).
 */
export function useInboxActions(projectId: string) {
  const queryClient = useQueryClient();

  const settle = async (response: Response) => {
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(inboxErrorMessage(body));
    }
    await queryClient.invalidateQueries({ queryKey: inboxKey(projectId) });
  };

  const itemRoute = client.ui.projects[':projectId'].inbox[':itemId'];
  const param = (itemId: string) => ({ param: { projectId, itemId } });

  // Bodies ride as variables, not literals: the handlers parse their own
  // json (no hono validator), so the inferred input carries `param` only and
  // an inline `json` property would trip the excess-property check — the
  // same shape as the projects attach call.
  const capture = useMutation({
    mutationFn: async (input: CaptureInput) => {
      const args = { param: { projectId }, json: input };
      await settle(await client.ui.projects[':projectId'].inbox.$post(args));
    },
  });

  const dismiss = useMutation({
    mutationFn: async ({
      itemId,
      reason,
    }: {
      itemId: string;
      reason: string;
    }) => {
      const args = { ...param(itemId), json: { reason } };
      await settle(await itemRoute.dismiss.$post(args));
    },
  });

  const defer = useMutation({
    mutationFn: async ({
      itemId,
      until,
    }: {
      itemId: string;
      until: string;
    }) => {
      const args = { ...param(itemId), json: { until } };
      await settle(await itemRoute.defer.$post(args));
    },
  });

  const wake = useMutation({
    mutationFn: async (itemId: string) => {
      await settle(await itemRoute.wake.$post(param(itemId)));
    },
  });

  const promote = useMutation({
    mutationFn: async (itemId: string) => {
      await settle(await itemRoute.promote.$post(param(itemId)));
    },
  });

  const restore = useMutation({
    mutationFn: async (itemId: string) => {
      await settle(await itemRoute.restore.$post(param(itemId)));
    },
  });

  return { capture, dismiss, defer, wake, promote, restore };
}
