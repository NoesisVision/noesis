import type { CallToolResult } from '@modelcontextprotocol/server';
import {
  type Change,
  ChangeSchema,
  type CreateChange,
  CreateChangeSchema,
} from '#backend/app/changes/change';
import {
  type ChangesService,
  DuplicateChangeError,
} from '#backend/app/changes/changes.service';
import { APPEND, defineTool, type ToolRegistration } from '../tool';
import { CREATE_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';

export function createChangeTool(changes: ChangesService): ToolRegistration {
  return defineTool(
    CREATE_CHANGE,
    {
      title: 'Create change',
      description:
        'Creates a change: the unit of work everything else in Noesis hangs off. The change is what a feature, fix, improvement or chore is called here, and it collects the documents that inform it. The server derives the slug from the name and starts the change in discovery.',
      inputSchema: CreateChangeSchema,
      outputSchema: ChangeSchema,
      annotations: APPEND,
    },
    (input) => create(changes, input),
  );
}

async function create(
  changes: ChangesService,
  input: CreateChange,
): Promise<CallToolResult> {
  try {
    return created(await changes.create(input));
  } catch (error) {
    if (error instanceof DuplicateChangeError) return duplicate(error);
    throw error;
  }
}

function created(change: Change): CallToolResult {
  return success(
    `Created change ${change.slug} (${change.type}, ${change.status}). Refer to it by this slug.`,
    change,
  );
}

function duplicate(error: DuplicateChangeError): CallToolResult {
  return failure(
    error.message,
    error.field === 'key'
      ? 'Work on the existing change, or pass a different tracker key.'
      : 'Work on the existing change, or give this one a name that reads differently.',
  );
}
