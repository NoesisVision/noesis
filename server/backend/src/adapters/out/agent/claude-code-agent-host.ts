import {
  type CanUseTool,
  type PermissionResult,
  type PermissionUpdate,
  type Query,
  query,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKPartialAssistantMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentHost } from '#backend/app/agent/agent-host';
import {
  AgentQuestion,
  type PermissionDecision,
} from '#backend/app/agent/agent-session';
import type { AgentTranscript } from '#backend/app/agent/agent-transcript';
import { promptOf, startsTask } from '#backend/app/agent/design-task';
import type { SendAgentMessage } from '#backend/app/agent/send-agent-message';
import { serverLogger } from '#backend/platform/logging/logging';
import { AsyncQueue } from './async-queue';
import { describeToolInput, summarizeToolInput } from './tool-summary';

const log = serverLogger('agent');

const ASK_USER_QUESTION = 'AskUserQuestion';

export interface ClaudeCodeAgentHostOptions {
  transcript: AgentTranscript;
  /** The repository the session works in. */
  cwd: string;
  /** The person's own Claude Code binary, logged in on this machine. */
  claudeExecutable: string;
  /** The Noesis plugin, for its MCP server and skills. */
  pluginRoot: string;
  /** What the session's processes see beyond this process's environment. */
  env: Record<string, string>;
  /** Tools and rules the session runs without asking the page. */
  allowedTools: string[];
}

/** A question or permission held open until the page answers it. */
interface Held {
  kind: 'question' | 'permission';
  input: Record<string, unknown>;
  suggestions: PermissionUpdate[];
  resolve: (result: PermissionResult) => void;
}

/**
 * A Claude Code session of the service's own, driven through the Agent SDK:
 * the person's messages go in as a stream, the session's messages come back
 * and land in the transcript, and every question or permission the session
 * raises waits for the page.
 *
 * The SDK runs the unmodified `claude` binary installed on this machine, so
 * the session is the person's own: their login, their settings, their
 * plugins. The service passes nothing about credentials.
 */
export class ClaudeCodeAgentHost implements AgentHost {
  readonly transcript: AgentTranscript;
  private readonly options: ClaudeCodeAgentHostOptions;
  private readonly inbox = new AsyncQueue<SDKUserMessage>();
  private readonly held = new Map<string, Held>();
  private readonly abort = new AbortController();
  private session: Query | undefined;
  /** The reply being streamed, until the whole message arrives. */
  private streaming: { id: string; text: string } | null = null;

  constructor(options: ClaudeCodeAgentHostOptions) {
    this.options = options;
    this.transcript = options.transcript;
  }

  /**
   * Starts the session; it idles until the first message, and says who it
   * is — the Claude Code version, the model — only with its first turn.
   */
  start(): void {
    this.session = this.open();
    void this.follow(this.session);
    this.transcript.setStatus('idle');
  }

  async send(message: SendAgentMessage): Promise<void> {
    const starts = startsTask(message.task, this.transcript.lastTask());
    this.transcript.append({
      kind: 'user',
      text: message.text,
      attachments: message.attachments,
      task: message.task ?? null,
      starts,
    });
    if (!this.alive()) {
      this.transcript.note(
        'The session has ended; start Noesis again to open a new one.',
        'error',
      );
      return;
    }
    this.transcript.setStatus('working');
    this.inbox.push(userMessage(message, starts));
    await Promise.resolve();
  }

  async answer(
    toolUseId: string,
    answers: Record<string, string>,
  ): Promise<void> {
    const held = this.take(toolUseId, 'question');
    if (held === undefined) return;
    this.recordAnswers(toolUseId, answers);
    this.transcript.setStatus('working');
    held.resolve({
      behavior: 'allow',
      updatedInput: { ...held.input, answers },
    });
    await Promise.resolve();
  }

  async decide(toolUseId: string, decision: PermissionDecision): Promise<void> {
    const held = this.take(toolUseId, 'permission');
    if (held === undefined) return;
    this.recordDecision(toolUseId, decision);
    this.transcript.setStatus('working');
    held.resolve(decided(held, decision));
    await Promise.resolve();
  }

  async interrupt(): Promise<void> {
    this.refuseAll();
    await this.session?.interrupt();
  }

  async stop(): Promise<void> {
    this.refuseAll();
    this.abort.abort();
    this.inbox.end();
    this.session?.close();
    await Promise.resolve();
  }

  private alive(): boolean {
    const { status } = this.transcript.view();
    return status !== 'stopped' && status !== 'failed';
  }

  private open(): Query {
    const { cwd, claudeExecutable, pluginRoot, env, allowedTools } =
      this.options;
    return query({
      prompt: this.inbox,
      options: {
        cwd,
        pathToClaudeCodeExecutable: claudeExecutable,
        plugins: [{ type: 'local', path: pluginRoot }],
        // The session's environment is the person's, as a terminal's would
        // be; the service adds only what names its own process.
        env: { ...process.env, ...env },
        permissionMode: 'default',
        allowedTools,
        includePartialMessages: true,
        abortController: this.abort,
        canUseTool: this.canUseTool,
        stderr: (line) => log.debug('claude: {line}', { line }),
      },
    });
  }

  private async follow(session: Query): Promise<void> {
    try {
      for await (const message of session) this.receive(message);
      this.closeReply();
      this.transcript.setStatus('stopped', 'The session ended.');
    } catch (error) {
      if (this.abort.signal.aborted) return;
      log.error('the agent session failed: {error}', { error: String(error) });
      this.closeReply();
      this.transcript.setStatus('failed', String(error));
    }
  }

  private receive(message: SDKMessage): void {
    // A subagent's messages belong to its tool call, not to the transcript.
    if ('parent_tool_use_id' in message && message.parent_tool_use_id !== null)
      return;
    switch (message.type) {
      case 'system':
        // Opens every turn, so it says nothing about the status.
        if (
          message.subtype === 'init' &&
          this.transcript.view().sessionId === null
        ) {
          this.transcript.setSessionId(message.session_id);
          this.transcript.note(
            `Claude Code ${message.claude_code_version}, ${message.model}.`,
          );
        }
        return;
      case 'stream_event':
        this.stream(message);
        return;
      case 'assistant':
        this.spoken(message);
        return;
      case 'user':
        this.toolResults(message);
        return;
      case 'result':
        this.closeReply();
        if (message.is_error && message.subtype !== 'success') {
          this.transcript.note(message.errors.join('\n'), 'error');
        }
        this.transcript.setStatus('idle');
        return;
      default:
        return;
    }
  }

  private stream(message: SDKPartialAssistantMessage): void {
    const { event } = message;
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const current = this.streaming ?? this.openReply();
      current.text += event.delta.text;
      const { id, text } = current;
      this.transcript.update(id, (entry) => ({ ...entry, text }));
    }
  }

  private openReply(): { id: string; text: string } {
    const entry = this.transcript.append({
      kind: 'assistant',
      text: '',
      streaming: true,
    });
    this.streaming = { id: entry.id, text: '' };
    return this.streaming;
  }

  /** Whatever was streamed stands as the reply; nothing more is coming for it. */
  private closeReply(text?: string): void {
    if (this.streaming === null) return;
    const { id } = this.streaming;
    this.streaming = null;
    this.transcript.update(id, (entry) => ({
      ...entry,
      ...(text === undefined ? {} : { text }),
      streaming: false,
    }));
  }

  /** The whole message: its text replaces what was streamed, its tool calls open tool entries. */
  private spoken(message: SDKAssistantMessage): void {
    for (const block of message.message.content) {
      if (block.type === 'text') {
        if (this.streaming === null) {
          this.transcript.append({
            kind: 'assistant',
            text: block.text,
            streaming: false,
          });
        } else {
          this.closeReply(block.text);
        }
      } else if (
        block.type === 'tool_use' &&
        block.name !== ASK_USER_QUESTION
      ) {
        this.transcript.append({
          kind: 'tool',
          toolUseId: block.id,
          tool: block.name,
          summary: summarizeToolInput(block.input as Record<string, unknown>),
          state: 'running',
        });
      }
    }
  }

  private toolResults(message: SDKUserMessage): void {
    const { content } = message.message;
    if (typeof content === 'string') return;
    for (const block of content) {
      if (block.type !== 'tool_result') continue;
      const tool = this.transcript.find(
        'tool',
        (entry) => entry.toolUseId === block.tool_use_id,
      );
      if (tool === undefined) continue;
      const state = block.is_error ? 'failed' : 'done';
      this.transcript.update(tool.id, (entry) => ({ ...entry, state }));
    }
  }

  private readonly canUseTool: CanUseTool = (toolName, input, options) => {
    const { toolUseID, signal, suggestions = [] } = options;
    if (signal.aborted) return Promise.resolve(DENIED);
    return new Promise<PermissionResult>((resolve) => {
      const kind = toolName === ASK_USER_QUESTION ? 'question' : 'permission';
      this.held.set(toolUseID, { kind, input, suggestions, resolve });
      signal.addEventListener('abort', () => this.refuse(toolUseID), {
        once: true,
      });
      this.ask(kind, toolUseID, toolName, input);
      this.transcript.setStatus('waiting');
    });
  };

  private ask(
    kind: Held['kind'],
    toolUseId: string,
    tool: string,
    input: Record<string, unknown>,
  ): void {
    if (kind === 'question') {
      this.transcript.append({
        kind,
        toolUseId,
        questions: questionsOf(input),
        answers: null,
      });
      return;
    }
    this.transcript.append({
      kind,
      toolUseId,
      tool,
      summary: summarizeToolInput(input),
      detail: describeToolInput(input),
      decision: null,
    });
  }

  /** The held prompt of that kind, taken out of the map; nothing for another kind or none. */
  private take(toolUseId: string, kind: Held['kind']): Held | undefined {
    const held = this.held.get(toolUseId);
    if (held === undefined || held.kind !== kind) return undefined;
    this.held.delete(toolUseId);
    return held;
  }

  private recordAnswers(
    toolUseId: string,
    answers: Record<string, string>,
  ): void {
    const asked = this.transcript.find(
      'question',
      (entry) => entry.toolUseId === toolUseId,
    );
    if (asked !== undefined) {
      this.transcript.update(asked.id, (entry) => ({ ...entry, answers }));
    }
  }

  private recordDecision(
    toolUseId: string,
    decision: PermissionDecision,
  ): void {
    const asked = this.transcript.find(
      'permission',
      (entry) => entry.toolUseId === toolUseId,
    );
    if (asked !== undefined) {
      this.transcript.update(asked.id, (entry) => ({ ...entry, decision }));
    }
  }

  /** Refuses a held prompt, and says so where the page shows it. */
  private refuse(toolUseId: string): void {
    const held = this.held.get(toolUseId);
    if (held === undefined) return;
    this.held.delete(toolUseId);
    if (held.kind === 'question') this.recordAnswers(toolUseId, {});
    else this.recordDecision(toolUseId, 'deny');
    held.resolve(DENIED);
  }

  private refuseAll(): void {
    for (const toolUseId of this.held.keys()) this.refuse(toolUseId);
  }
}

const DENIED: PermissionResult = {
  behavior: 'deny',
  message: 'The person refused this in the Noesis page.',
};

/**
 * "Allow for this session" is exactly that: the rules the SDK suggests, kept
 * with the session rather than written where Claude Code would put them, a
 * settings file in the repository or the home directory.
 */
function decided(held: Held, decision: PermissionDecision): PermissionResult {
  if (decision === 'deny') return DENIED;
  const sessionRules: PermissionUpdate[] =
    decision === 'allowAlways'
      ? held.suggestions.map((rule) =>
          'destination' in rule ? { ...rule, destination: 'session' } : rule,
        )
      : [];
  return {
    behavior: 'allow',
    updatedInput: held.input,
    ...(sessionRules.length > 0 ? { updatedPermissions: sessionRules } : {}),
  };
}

function userMessage(
  message: SendAgentMessage,
  starts: boolean,
): SDKUserMessage {
  const { text, attachments, task } = message;
  return {
    type: 'user',
    message: {
      role: 'user',
      content: promptOf(text, attachments, task, starts),
    },
    parent_tool_use_id: null,
  };
}

/** The questions as the tool shapes them; an input that is not that asks nothing. */
function questionsOf(input: Record<string, unknown>): AgentQuestion[] {
  const parsed = z.array(AgentQuestion).safeParse(input.questions);
  return parsed.success ? parsed.data : [];
}
