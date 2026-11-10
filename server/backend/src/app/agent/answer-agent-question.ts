import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import type { AgentHost } from './agent-host';
import type { AgentSession } from './agent-session';

/** The person's answers to one `AskUserQuestion` call, by question text. */
export const AnswerAgentQuestion = z.object({
  toolUseId: z.string().min(1),
  answers: z.record(z.string(), z.string()),
});
export type AnswerAgentQuestion = z.infer<typeof AnswerAgentQuestion>;

export type AnswerAgentQuestionHandler = Handler<
  AnswerAgentQuestion,
  AgentSession
>;

export function answerAgentQuestionHandler(
  agent: AgentHost,
): AnswerAgentQuestionHandler {
  return {
    async handle({ toolUseId, answers }) {
      await agent.answer(toolUseId, answers);
      return agent.transcript.view();
    },
  };
}
