import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import type { AgentHost } from './agent-host';
import { type AgentSession, PermissionDecision } from './agent-session';

/** Whether the tool the session asked about may run. */
export const DecideAgentPermission = z.object({
  toolUseId: z.string().min(1),
  decision: PermissionDecision,
});
export type DecideAgentPermission = z.infer<typeof DecideAgentPermission>;

export type DecideAgentPermissionHandler = Handler<
  DecideAgentPermission,
  AgentSession
>;

export function decideAgentPermissionHandler(
  agent: AgentHost,
): DecideAgentPermissionHandler {
  return {
    async handle({ toolUseId, decision }) {
      await agent.decide(toolUseId, decision);
      return agent.transcript.view();
    },
  };
}
