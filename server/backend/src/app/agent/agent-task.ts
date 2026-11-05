import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DiagramSnapshot } from '#backend/app/system-model/diagram-plan';

/**
 * What the page is about when the person writes, and so which of the
 * plugin's skills the message starts: a design document for a change, a
 * revision of the one open, or a diagram of the system model.
 */
const DesignTask = z.object({
  kind: z.literal('design'),
  change: ChangeId,
  designDoc: DesignDocId.optional(),
});

const DiagramTask = z.object({
  kind: z.literal('diagram'),
  /** The diagram as it stands, so a step can build on it. */
  diagram: DiagramSnapshot,
});

export const AgentTask = z.discriminatedUnion('kind', [
  DesignTask,
  DiagramTask,
]);
export type AgentTask = z.infer<typeof AgentTask>;

const CREATE_DESIGN_DOC_SKILL = '/noesis:create-design-doc';
const UPDATE_DESIGN_DOC_SKILL = '/noesis:update-design-doc';
const EXPLORE_SYSTEM_MODEL_SKILL = '/noesis:explore-system-model';

/** The skill's invocation, as the session reads it at the head of a message. */
export function invocationOf(task: AgentTask): string {
  if (task.kind === 'diagram') return EXPLORE_SYSTEM_MODEL_SKILL;
  return task.designDoc === undefined
    ? `${CREATE_DESIGN_DOC_SKILL} ${task.change} 1`
    : `${UPDATE_DESIGN_DOC_SKILL} ${task.change} ${task.designDoc}`;
}

/** The same place: the same change and design document, or the diagram. */
function samePlace(a: AgentTask, b: AgentTask): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'diagram' || b.kind === 'diagram') return true;
  return a.change === b.change && a.designDoc === b.designDoc;
}

/**
 * Whether a message starts the task's skill: it does when the task is not
 * the one the last message was about, so a follow-up in the same place is
 * read as that, and a new place starts the skill again.
 */
export function startsTask(
  task: AgentTask | undefined,
  last: AgentTask | null,
): boolean {
  if (task === undefined) return false;
  return last === null || !samePlace(task, last);
}

/**
 * The message as the session reads it: the invocation when the task starts,
 * the person's words, the files by path, and, for a diagram, how it stands
 * now, every time, since every step builds on it.
 */
export function promptOf(
  text: string,
  attachments: readonly { name: string; path: string }[],
  task: AgentTask | undefined,
  starts: boolean,
): string {
  const lines: string[] = [];
  if (starts && task !== undefined) lines.push(invocationOf(task));
  lines.push(text);
  if (attachments.length > 0) {
    lines.push('', 'Attached files (read them by path):');
    for (const file of attachments) lines.push(`- ${file.name}: ${file.path}`);
  }
  if (task?.kind === 'diagram') {
    lines.push(
      '',
      'The diagram now, as JSON (`drawn`: the elements on it, by id; `relations`: the relations drawn):',
      '```json',
      JSON.stringify(task.diagram),
      '```',
    );
  }
  return lines.join('\n');
}
