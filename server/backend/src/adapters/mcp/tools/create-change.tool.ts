import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  type Change,
  ChangeSchema,
  NewChangeSchema,
} from '#backend/app/changes/change';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES, UPDATE_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { NO_ID, workingFilePath } from './change-scoped';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSchema })
  .describe('The change as stored, with the id the server minted.');

export function createChangeTool(
  changes: ChangesService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    CREATE_CHANGE,
    {
      title: 'Create change',
      description: `Creates a change: the unit of work everything else in Noesis hangs off. The change is what a feature, fix, improvement or chore is called here, and it collects the documents that inform it. The server mints its id from today's date and the name, and every call creates a new change, so check ${LIST_CHANGES} first and use ${UPDATE_CHANGE} for one that exists. Write the change to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: z
        .object({
          path: workingFilePath(
            session,
            SUBJECT,
            `{ "name", "type", "key", "description" }. ${NO_ID} A new change starts in discovery.`,
          ),
        })
        .describe('Where the change is written.'),
      outputSchema,
      annotations: CREATE,
    },
    (input) => create(changes, session, input.path),
  );
}

async function create(
  changes: ChangesService,
  session: SessionDir,
  path: string,
): Promise<CallToolResult> {
  const change = await readWorkingFile(session, NewChangeSchema, path);
  if (change.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${change.error}`);
  }
  return created(await changes.create(change.value));
}

function created(change: Change): CallToolResult {
  return success(
    `Created change ${change.id} (${change.type}, ${change.status}). Refer to it by this id.`,
    { change },
  );
}
