import type { Handler } from '#backend/app/handler';
import type { AgentHost } from './agent-host';
import type { AgentSession } from './agent-session';

export type InterruptAgentHandler = Handler<void, AgentSession>;

export function interruptAgentHandler(agent: AgentHost): InterruptAgentHandler {
  return {
    async handle() {
      await agent.interrupt();
      return agent.transcript.view();
    },
  };
}
