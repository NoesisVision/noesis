import { parseResponse } from 'hono/client';
import { z } from 'zod';
import {
  ChangeSummary,
  CreateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { NoesisApi } from '#mcp/backend/noesis-api';
import { CREATE, defineTool, type ToolRegistration } from '#mcp/server/tool';
import {
  CREATE_CHANGE,
  LIST_CHANGES,
  UPDATE_CHANGE,
} from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';
import { NO_ID, workingFilePath } from './working-file';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSummary })
  .describe('The change as stored, with the id the server minted.');

export function createChangeTool(
  api: NoesisApi,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    CREATE_CHANGE,
    {
      title: 'Create change',
      description: `Creates a change: the unit of work everything else in Noesis hangs off. The change is what a feature, fix, improvement or chore is called here, and it collects the source documents that inform it and the design documents that describe it. The server mints its id from today's date and the name, and every call creates a new change, so check ${LIST_CHANGES} first and use ${UPDATE_CHANGE} for one that exists. Write the change to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: z
        .object({
          path: workingFilePath(
            files,
            SUBJECT,
            `{ "name", "type", "key", "description" }. ${NO_ID} A new change starts in discovery.`,
          ),
        })
        .describe('Where the change is written.'),
      outputSchema,
      annotations: CREATE,
    },
    async (input) => {
      const file = await files.read(SUBJECT, CreateChange, input.path);
      const { change } = await parseResponse(api.changes.$post({ json: file }));
      return {
        summary: `Created change ${change.id} (${change.type}, ${change.status}). Refer to it by this id.`,
        structuredContent: { change },
      };
    },
  );
}
