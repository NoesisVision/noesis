import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import {
  type Change,
  ChangeContentSchema,
  ChangeSchema,
} from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES, UPDATE_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { workingFilePath } from './change-scoped';

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
            `{ "name", "type", "key", "status", "description" }, without "id". Carry the "status" ${LIST_CHANGES} returned unless the change moves on; left out, it goes back to discovery.`,
          ),
        })
        .describe(
          'The change to update, and where its new content is written.',
        ),
      outputSchema,
      annotations: UPDATE,
    },
    (input) => update(changes, files, input.id, input.path),
  );
}

async function update(
  changes: ChangesService,
  files: SessionFiles,
  id: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const change = await files.read(ChangeContentSchema, path);
  if (change.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${change.error}`);
  }
  try {
    return updated(await changes.update(id, change.value));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return failure(
        error.message,
        `Find its id with ${LIST_CHANGES}, or create it with ${CREATE_CHANGE}.`,
      );
    }
    throw error;
  }
}

function updated(change: Change): CallToolResult {
  return success(
    `Updated change ${change.id} (${change.type}, ${change.status}).`,
    { change },
  );
}
