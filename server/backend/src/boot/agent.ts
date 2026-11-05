import { dirname, join } from 'node:path';
import { AttachedAgentHost } from '#backend/adapters/in/mcp/attached-agent-host';
import { ChannelLink } from '#backend/adapters/in/mcp/channel-link';
import {
  GET_DESIGN_DOC_IN_CHANGE,
  GET_DOCUMENT_IN_CHANGE,
  GET_NEWEST_SYSTEM_MODEL,
  GET_SYSTEM_MODEL_GRAPH,
  LIST_CHANGES,
  LIST_DESIGN_DOCS_IN_CHANGE,
  LIST_DOCUMENTS_IN_CHANGE,
} from '#backend/adapters/in/mcp/tool-names';
import type { PageReplies } from '#backend/adapters/in/mcp/tools/reply-to-noesis-page.tool';
import { ClaudeCodeAgentHost } from '#backend/adapters/out/agent/claude-code-agent-host';
import { SessionAgentFiles } from '#backend/adapters/out/agent/session-agent-files';
import { NOESIS_TOOL_PREFIX } from '#backend/adapters/out/agent/tool-policy';
import type { AgentFiles } from '#backend/app/agent/agent-files';
import type { AgentHost } from '#backend/app/agent/agent-host';
import { AgentTranscript } from '#backend/app/agent/agent-transcript';
import { type Clock, systemClock } from '#backend/app/clock';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';
import { production } from './process';

const log = serverLogger('agent');

/**
 * What the session may do without asking: read the repository and the
 * plugin's own files, write its working files, and read the graph through
 * Noesis. Every write to the graph, every command and every file beyond
 * these still comes to the page. A path rule without a prefix is relative
 * to the project; `//` makes it absolute.
 */
function allowedTools(pluginRoot: string): string[] {
  return [
    'Read(./**)',
    `Read(//${pluginRoot}/**)`,
    'Glob',
    'Grep',
    'Write(.noesis/sessions/**)',
    'Edit(.noesis/sessions/**)',
    ...[
      LIST_CHANGES,
      LIST_DOCUMENTS_IN_CHANGE,
      GET_DOCUMENT_IN_CHANGE,
      LIST_DESIGN_DOCS_IN_CHANGE,
      GET_DESIGN_DOC_IN_CHANGE,
      GET_NEWEST_SYSTEM_MODEL,
      GET_SYSTEM_MODEL_GRAPH,
    ].map((tool) => `${NOESIS_TOOL_PREFIX}${tool}`),
  ];
}

export interface AgentBootOptions {
  noesis: NoesisDir;
  /** This session's scratch directory, where the person's files go. */
  sessionDir: string;
  /** A person started the service: it brings a session of its own. */
  embedded: boolean;
  clock?: Clock;
}

export interface AgentBoot {
  host: AgentHost;
  files: AgentFiles;
  /** The channel into the session that started the service; none when the service started its own. */
  channel: ChannelLink | null;
  /** Where that session's replies land; none when the service started its own. */
  replies: PageReplies | null;
}

/**
 * Which session the page speaks to. Started by a person, the service starts
 * a Claude Code session beside the page, from the `claude` on this machine.
 * Started by an agent over stdio, it never starts another: the page attaches
 * to the session that started it.
 */
export function bootAgent(options: AgentBootOptions): AgentBoot {
  const { noesis, sessionDir, embedded, clock = systemClock } = options;
  const files = new SessionAgentFiles(sessionDir);
  if (!embedded) {
    const transcript = new AgentTranscript('attached', 'idle', clock);
    const channel = new ChannelLink();
    const host = new AttachedAgentHost(transcript, channel);
    return { host, files, channel, replies: host };
  }
  const transcript = new AgentTranscript('embedded', 'starting', clock);
  const claudeExecutable = Bun.which('claude');
  if (claudeExecutable === null) {
    transcript.setStatus(
      'failed',
      'No `claude` on PATH. Install Claude Code and log in, then start Noesis again.',
    );
    return { host: idle(transcript), files, channel: null, replies: null };
  }
  const plugin = pluginRoot();
  const host = new ClaudeCodeAgentHost({
    transcript,
    cwd: noesis.root,
    claudeExecutable,
    pluginRoot: plugin,
    env: serviceEnv(),
    allowedTools: allowedTools(plugin),
  });
  log.info('starting a Claude Code session with {claude}', {
    claude: claudeExecutable,
  });
  host.start();
  return { host, files, channel: null, replies: null };
}

/**
 * The plugin the session loads: the one this service ships in, or, from
 * source, the checkout's.
 */
function pluginRoot(): string {
  return production
    ? dirname(import.meta.dir)
    : join(import.meta.dir, '../../../../plugins/claude-code');
}

/**
 * The session's own Noesis process keeps its browser closed: the page is
 * already open. From source it runs this checkout's service, as the
 * plugin's `.mcp.json` reads `NOESIS_SERVICE_ENTRY`.
 */
function serviceEnv(): Record<string, string> {
  const env: Record<string, string> = { NOESIS_OPEN_BROWSER: '0' };
  if (!production)
    env.NOESIS_SERVICE_ENTRY = join(import.meta.dir, '../main.ts');
  return env;
}

/** A host with nothing behind it: the transcript says why. */
function idle(transcript: AgentTranscript): AgentHost {
  const nothing = () => Promise.resolve();
  return {
    transcript,
    send: nothing,
    answer: nothing,
    decide: nothing,
    interrupt: nothing,
    stop: nothing,
  };
}
