import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { ChangeContentSchema, ChangeSchema } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES, UPDATE_CHANGE } from '../tool-names';
import { success } from '../tool-result';
import { fromWorkingFile, workingFilePath } from './working-file';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSchema })
  .describe('The change as stored.');

export function updateChangeTool(
  changes: ChangesService,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_CHANGE,
    {
      title: 'Update change',
      description: `Replaces an existing change whole: its name, type, key, status and description. The id stays as it was, even when the name changes. Never creates a change; use ${CREATE_CHANGE} for that. Write the change to a JSON working file under the session scratch directory and pass its path with the change's id.`,
      inputSchema: z
        .object({
          id: ChangeId.describe(
            `The id of the change to update, as ${LIST_CHANGES} lists it.`,
          ),
          path: workingFilePath(
            files,
            SUBJECT,
            `{ "name", "type", "key", "status", "description" }, without "id". "status" is required: carry the one ${LIST_CHANGES} returned unless the change moves on.`,
          ),
        })
        .describe(
          'The change to update, and where its new content is written.',
        ),
      outputSchema,
      annotations: UPDATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        ChangeContentSchema,
        SUBJECT,
        input.path,
        async (file) => {
          const change = await changes.update(input.id, file);
          return success(
            `Updated change ${change.id} (${change.type}, ${change.status}).`,
            { change },
          );
        },
      ),
  );
}
