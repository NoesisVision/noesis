import { IconSparkles } from '@tabler/icons-react';
import type { AgentStatus } from '#backend/app/agent/agent-session.ts';

/** The icon the agent is drawn with, wherever it is named: the bar, the panel, a button that calls it. */
export const AgentIcon = IconSparkles;

/** What each status says to the person, and the colour it is marked with. */
export const AGENT_STATUS_META: Record<
  AgentStatus,
  { label: string; color: string; busy: boolean }
> = {
  starting: { label: 'Starting', color: 'gray', busy: true },
  idle: { label: 'Ready', color: 'teal', busy: false },
  working: { label: 'Working', color: 'brand', busy: true },
  waiting: { label: 'Needs you', color: 'orange', busy: false },
  stopped: { label: 'Ended', color: 'gray', busy: false },
  failed: { label: 'Unavailable', color: 'red', busy: false },
};

/** The plugin's skills, as a message invokes them. */
const CREATE_DESIGN_DOC_SKILL = '/noesis:create-design-doc';
const UPDATE_DESIGN_DOC_SKILL = '/noesis:update-design-doc';

/** The message that asks the agent to design a change into a new design document. */
export function createDesignDocPrompt(changeId: string): string {
  return `${CREATE_DESIGN_DOC_SKILL} ${changeId} 1`;
}

/** The message that asks the agent to revise a design document; what to change follows it. */
export function updateDesignDocPrompt(changeId: string, docId: string): string {
  return `${UPDATE_DESIGN_DOC_SKILL} ${changeId} ${docId} `;
}

/**
 * The most a file may weigh: the route takes a 4 MiB body, and a binary
 * file travels as base64, a third larger than its bytes.
 */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const TEXT_EXTENSIONS =
  /\.(md|markdown|txt|json|ya?ml|csv|xml|html?|puml|mmd|c4)$/i;

/** Whether a file is one the agent reads as text: by its type, else by its name. */
export function isTextFile(file: { name: string; type: string }): boolean {
  return (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    TEXT_EXTENSIONS.test(file.name)
  );
}

/** A name the service accepts: one segment, letters, digits, dots, dashes and underscores. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  return cleaned === '' ? 'file' : cleaned.slice(0, 200);
}

/** `mcp__plugin_noesis_noesis__list_changes` reads as `list_changes`. */
export function toolLabel(tool: string): string {
  return tool.split('__').at(-1) ?? tool;
}
