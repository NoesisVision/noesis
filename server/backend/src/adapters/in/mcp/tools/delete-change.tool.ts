import { z } from 'zod';
import { ChangeSchema } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import type { DeleteChangeHandler } from '#backend/app/changes/delete-change';
import { DELETE, defineTool, type ToolRegistration } from '../tool';
import { DELETE_CHANGE, LIST_CHANGES } from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({
    id: ChangeId.describe(
      `The id of the change to delete, as ${LIST_CHANGES} lists it.`,
    ),
  })
  .describe('The change to delete.');

const outputSchema = z
  .object({ change: ChangeSchema })
  .describe('The change as it was before it was deleted.');

export function deleteChangeTool(
  deleteChange: DeleteChangeHandler,
): ToolRegistration {
  return defineTool(
    DELETE_CHANGE,
    {
      title: 'Delete change',
      description: `Deletes a change for good, with every document and design document it holds; the server keeps no copy. Call it only when the user asks for this change to be deleted, and confirm the change by name with them first. Find the id with ${LIST_CHANGES}.`,
      inputSchema,
      outputSchema,
      annotations: DELETE,
    },
    async (input) => {
      const change = await deleteChange.handle(input);
      return success(
        `Deleted change ${change.id} ("${change.name}") and everything it held.`,
        { change },
      );
    },
  );
}
