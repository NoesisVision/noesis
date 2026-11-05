import type { AgentFiles } from '#backend/app/agent/agent-files';
import type { AgentHost } from '#backend/app/agent/agent-host';
import type { PermissionDecision } from '#backend/app/agent/agent-session';
import { AgentTranscript } from '#backend/app/agent/agent-transcript';
import type { SendAgentMessage } from '#backend/app/agent/send-agent-message';
import type { Clock } from '#backend/app/clock';

export interface FakeAgent {
  host: AgentHost;
  files: AgentFiles;
  sent: SendAgentMessage[];
  answered: { toolUseId: string; answers: Record<string, string> }[];
  decided: { toolUseId: string; decision: PermissionDecision }[];
  interrupted: number;
  saved: { name: string; bytes: Uint8Array }[];
}

/** An agent that records what the page sends, with a transcript to read back. */
export function fakeAgent(clock: Clock): FakeAgent {
  const transcript = new AgentTranscript('embedded', 'idle', clock);
  const fake: FakeAgent = {
    sent: [],
    answered: [],
    decided: [],
    interrupted: 0,
    saved: [],
    host: {
      transcript,
      send: (message) => {
        fake.sent.push(message);
        transcript.append({
          kind: 'user',
          text: message.text,
          attachments: message.attachments,
          task: message.task ?? null,
          starts: message.task !== undefined,
        });
        return Promise.resolve();
      },
      answer: (toolUseId, answers) => {
        fake.answered.push({ toolUseId, answers });
        return Promise.resolve();
      },
      decide: (toolUseId, decision) => {
        fake.decided.push({ toolUseId, decision });
        return Promise.resolve();
      },
      interrupt: () => {
        fake.interrupted += 1;
        return Promise.resolve();
      },
      stop: () => Promise.resolve(),
    },
    files: {
      save: (name, bytes) => {
        fake.saved.push({ name, bytes });
        return Promise.resolve(`/scratch/uploads/${name}`);
      },
    },
  };
  return fake;
}
