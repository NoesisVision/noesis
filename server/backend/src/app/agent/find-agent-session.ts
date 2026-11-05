import type { Handler } from '#backend/app/handler';
import type { AgentHost } from './agent-host';
import type { AgentSession } from './agent-session';

export type FindAgentSessionHandler = Handler<void, AgentSession>;

export function findAgentSessionHandler(
  agent: AgentHost,
): FindAgentSessionHandler {
  return {
    handle: () => Promise.resolve(agent.transcript.view()),
  };
}
