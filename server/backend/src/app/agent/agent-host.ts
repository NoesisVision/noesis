import type { AgentTranscript } from './agent-transcript';
import type { SendAgentMessage } from './send-agent-message';

/**
 * The port onto a Claude Code session, whichever way the service reaches it:
 * what the page says to it, and the transcript it reads back.
 */
export interface AgentHost {
  readonly transcript: AgentTranscript;
  send(message: SendAgentMessage): Promise<void>;
  /** Answers the question the session is waiting on; nothing when none is. */
  answer(toolUseId: string, answers: Record<string, string>): Promise<void>;
  /** Decides the permission the session is waiting on; nothing when none is. */
  decide(
    toolUseId: string,
    decision: 'allow' | 'allowAlways' | 'deny',
  ): Promise<void>;
  /** Stops the turn in progress; the session stays. */
  interrupt(): Promise<void>;
  /** Ends the session; the service is shutting down. */
  stop(): Promise<void>;
}
