import { IconSparkles } from '@tabler/icons-react';
import type { AgentStatus } from '#backend/app/agent/agent-session.ts';
import type { AgentTask } from '#backend/app/agent/agent-task.ts';

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

/** What a task does, in the person's words: the verb for the chip and the caption. */
export function taskVerb(task: AgentTask): string {
  if (task.kind === 'diagram') return 'Composing the diagram';
  return task.designDoc === undefined
    ? 'New design document'
    : 'Revising the design document';
}

/** What the field asks for, by what the message will do. */
export function taskPlaceholder(task: AgentTask | undefined): string {
  if (task === undefined) return 'Ask the agent…';
  if (task.kind === 'diagram') return 'What should the diagram show?';
  return task.designDoc === undefined
    ? 'What should the design cover?'
    : 'What should change in the design?';
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
