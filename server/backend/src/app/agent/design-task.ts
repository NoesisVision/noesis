import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';

/**
 * What the page is about when the person writes: a change, and the design
 * document open in it, if one is. It says which of the plugin's skills the
 * message starts: a design document for the change, or a revision of the
 * one open.
 */
export const DesignTask = z.object({
  change: ChangeId,
  designDoc: DesignDocId.optional(),
});
export type DesignTask = z.infer<typeof DesignTask>;

const CREATE_DESIGN_DOC_SKILL = '/noesis:create-design-doc';
const UPDATE_DESIGN_DOC_SKILL = '/noesis:update-design-doc';

/** The skill's invocation, as the session reads it at the head of a message. */
export function invocationOf(task: DesignTask): string {
  return task.designDoc === undefined
    ? `${CREATE_DESIGN_DOC_SKILL} ${task.change} 1`
    : `${UPDATE_DESIGN_DOC_SKILL} ${task.change} ${task.designDoc}`;
}

function sameTask(
  a: DesignTask | null | undefined,
  b: DesignTask | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  return a.change === b.change && a.designDoc === b.designDoc;
}

/**
 * Whether a message starts the task's skill: it does when the task is not
 * the one the last message was about, so a follow-up in the same place is
 * read as that, and a new place starts the skill again.
 */
export function startsTask(
  task: DesignTask | undefined,
  last: DesignTask | null,
): boolean {
  return task !== undefined && !sameTask(task, last);
}

/** The message as the session reads it: the invocation, the person's words, the files by path. */
export function promptOf(
  text: string,
  attachments: readonly { name: string; path: string }[],
  task: DesignTask | undefined,
  starts: boolean,
): string {
  const lines: string[] = [];
  if (starts && task !== undefined) lines.push(invocationOf(task));
  lines.push(text);
  if (attachments.length > 0) {
    lines.push('', 'Attached files (read them by path):');
    for (const file of attachments) lines.push(`- ${file.name}: ${file.path}`);
  }
  return lines.join('\n');
}
