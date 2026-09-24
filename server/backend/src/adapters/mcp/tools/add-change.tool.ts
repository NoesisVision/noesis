import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { type Change, ChangeSchema } from '#backend/app/changes/change';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { UPSERT, defineTool, type ToolRegistration } from '../tool';
import { ADD_CHANGE, LIST_CHANGES } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import {
  createdOrUpdated,
  idInstructions,
  workingFilePath,
} from './change-scoped';

const SUBJECT = 'change';

const outputSchema = z
  .object({
    change: ChangeSchema,
    created: z
      .boolean()
      .describe(
        'true when the id was new; false when an existing change was updated in place.',
      ),
  })
  .describe('The change as stored, and whether it was created or updated.');

export function addChangeTool(
  changes: ChangesService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    ADD_CHANGE,
    {
      title: 'Add change',
      description: `Adds a change: the unit of work everything else in Noesis hangs off. The change is what a feature, fix, improvement or chore is called here, and it collects the documents that inform it. A change whose id is already in use is updated in place, so check ${LIST_CHANGES} first; the answer says whether it was created or updated. Write the change to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: z
        .object({
          path: workingFilePath(
            session,
            SUBJECT,
            `{ "id", "name", "type", "key", "description" }; leave "status" out for a new change (it starts in discovery), or carry the value ${LIST_CHANGES} returned. ${idInstructions(SUBJECT, 'name')}`,
          ),
        })
        .describe('Where the change is written.'),
      outputSchema,
      annotations: UPSERT,
    },
    (input) => add(changes, session, input.path),
  );
}

async function add(
  changes: ChangesService,
  session: SessionDir,
  path: string,
): Promise<CallToolResult> {
  const change = await readWorkingFile(session, ChangeSchema, path);
  if (change.isErr()) {
    return failure(formatReport(SUBJECT, change.error));
  }
  const { value, created } = await changes.add(change.value);
  return added(value, created);
}

function added(change: Change, created: boolean): CallToolResult {
  return success(
    `${createdOrUpdated(created)} change ${change.id} (${change.type}, ${change.status}). Refer to it by this id.`,
    { change, created },
  );
}
