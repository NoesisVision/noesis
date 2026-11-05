import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import type { AgentHost } from './agent-host';
import { AgentAttachment, type AgentSession } from './agent-session';
import { DesignTask } from './design-task';

/** What the person types, with the files they attached to it and where they were. */
export const SendAgentMessage = z.object({
  text: z.string().trim().min(1).max(100_000),
  attachments: z.array(AgentAttachment).max(20).default([]),
  task: DesignTask.optional(),
});
export type SendAgentMessage = z.infer<typeof SendAgentMessage>;

export type SendAgentMessageHandler = Handler<SendAgentMessage, AgentSession>;

export function sendAgentMessageHandler(
  agent: AgentHost,
): SendAgentMessageHandler {
  return {
    async handle(message) {
      await agent.send(message);
      return agent.transcript.view();
    },
  };
}
