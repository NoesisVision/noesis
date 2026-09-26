import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { ChangeId } from '#backend/app/changes/model/change-id';
import {
  ChangeSummary,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { UpdateChangeCommand } from '#backend/app/changes/update-change';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES, UPDATE_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { workingFilePath } from './change-scoped';

const SUBJECT = 'change';

const outputSchema = z
  .object({ change: ChangeSummary })
  .describe('The change as stored.');

export function updateChangeTool(
  updateChange: Handler<UpdateChangeCommand, ChangeSummary>,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_CHANGE,
    {
      title: 'Update change',
      description: `Replaces what an existing change says of itself: its name, type, key, status and description. Its documents and design documents stay as they are. The id stays as it was, even when the name changes. Never creates a change; use ${CREATE_CHANGE} for that. Write the change to a JSON working file under the session scratch directory and pass its path with the change's id.`,
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
    (input) => update(updateChange, files, input.id, input.path),
  );
}

async function update(
  updateChange: Handler<UpdateChangeCommand, ChangeSummary>,
  files: SessionFiles,
  id: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const change = await files.read(UpdateChange, path);
  if (change.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${change.error}`);
  }
  try {
    return updated(await updateChange.handle({ id, change: change.value }));
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

function updated(change: ChangeSummary): CallToolResult {
  return success(
    `Updated change ${change.id} (${change.type}, ${change.status}).`,
    { change },
  );
}
