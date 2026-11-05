import type { AgentHost } from '#backend/app/agent/agent-host';
import type { AgentTranscript } from '#backend/app/agent/agent-transcript';
import type { SendAgentMessage } from '#backend/app/agent/send-agent-message';
import type { ChannelLink } from './channel-link';
import { REPLY_TO_NOESIS_PAGE } from './tool-names';

const ATTACHED_HINT =
  'An agent session started Noesis, so the page speaks into that session rather than starting another. Claude Code reads the page only when it was started with the Noesis channel loaded (`claude --dangerously-load-development-channels server:noesis`, a research preview); otherwise what you send here goes nowhere, and the session answers in its own terminal.';

/**
 * The session that started the service, reached through the MCP connection
 * it opened: a message from the page goes out as a channel notification, and
 * the session answers through the reply tool. Nothing here starts a process.
 * The session's own questions and permissions stay in its terminal.
 */
export class AttachedAgentHost implements AgentHost {
  readonly transcript: AgentTranscript;
  private readonly channel: ChannelLink;

  constructor(transcript: AgentTranscript, channel: ChannelLink) {
    this.transcript = transcript;
    this.channel = channel;
    this.transcript.setStatus('idle', ATTACHED_HINT);
  }

  async send(message: SendAgentMessage): Promise<void> {
    this.transcript.append({
      kind: 'user',
      text: message.text,
      attachments: message.attachments,
    });
    const delivered = await this.channel.notify(content(message), {
      reply_tool: REPLY_TO_NOESIS_PAGE,
    });
    if (!delivered) {
      this.transcript.note(
        'No agent session is connected to Noesis yet; the message went nowhere.',
        'error',
      );
    }
  }

  /** What the session says back, through the reply tool. */
  reply(text: string): void {
    this.transcript.append({ kind: 'assistant', text, streaming: false });
  }

  answer(): Promise<void> {
    return Promise.resolve();
  }

  decide(): Promise<void> {
    return Promise.resolve();
  }

  interrupt(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }
}

function content(message: SendAgentMessage): string {
  const lines = [message.text];
  if (message.attachments.length > 0) {
    lines.push('', 'Attached files (read them by path):');
    for (const file of message.attachments) {
      lines.push(`- ${file.name}: ${file.path}`);
    }
  }
  lines.push('', `Answer the person in the page with ${REPLY_TO_NOESIS_PAGE}.`);
  return lines.join('\n');
}
