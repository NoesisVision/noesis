import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { ChangeSchema, NewChangeSchema } from '#backend/app/changes/change';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES, UPDATE_CHANGE } from '../tool-names';
import { success } from '../tool-result';
import { fromWorkingFile, NO_ID, workingFilePath } from './working-file';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSchema })
  .describe('The change as stored, with the id the server minted.');

export function createChangeTool(
  changes: ChangesService,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    CREATE_CHANGE,
    {
      title: 'Create change',
      description: `Creates a change: the unit of work everything else in Noesis hangs off. The change is what a feature, fix, improvement or chore is called here, and it collects the documents that inform it. The server mints its id from today's date and the name, and every call creates a new change, so check ${LIST_CHANGES} first and use ${UPDATE_CHANGE} for one that exists. Write the change to a JSON working file under the session scratch directory and pass its path.`,
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
    (input) =>
      fromWorkingFile(
        files,
        NewChangeSchema,
        SUBJECT,
        input.path,
        async (file) => {
          const change = await changes.create(file);
          return success(
            `Created change ${change.id} (${change.type}, ${change.status}). Refer to it by this id.`,
            { change },
          );
        },
      ),
  );
}
