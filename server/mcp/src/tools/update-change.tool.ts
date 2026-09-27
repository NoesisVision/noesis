import { parseResponse } from 'hono/client';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import {
  ChangeSummary,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { NoesisApi } from '#mcp/backend/noesis-api';
import { UPDATE, defineTool, type ToolRegistration } from '#mcp/server/tool';
import {
  CREATE_CHANGE,
  LIST_CHANGES,
  UPDATE_CHANGE,
} from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';
import { workingFilePath } from './working-file';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSummary })
  .describe('The change as stored.');

export function updateChangeTool(
  api: NoesisApi,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_CHANGE,
    {
      title: 'Update change',
      description: `Replaces what an existing change says of itself: its name, type, key, status and description. Its source documents and design documents stay as they are. The id stays as it was, even when the name changes. Never creates a change; use ${CREATE_CHANGE} for that. Write the change to a JSON working file under the session scratch directory and pass its path with the change's id.`,
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
    async (input) => {
      const file = await files.read(SUBJECT, UpdateChange, input.path);
      const { change } = await parseResponse(
        api.changes[':id'].$patch({ param: { id: input.id }, json: file }),
      );
      return {
        summary: `Updated change ${change.id} (${change.type}, ${change.status}).`,
        structuredContent: { change },
      };
    },
  );
}
