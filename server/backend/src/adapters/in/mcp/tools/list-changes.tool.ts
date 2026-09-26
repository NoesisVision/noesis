import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  type ChangeEntry,
  ChangeWithEntries,
} from '#backend/app/changes/change-entry';
import type { Handler } from '#backend/app/handler';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES } from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({})
  .describe('Nothing to pass: the list is every change in the repository.');

const outputSchema = z
  .object({
    changes: z
      .array(ChangeWithEntries)
      .describe(
        'Every change, newest first, each with its design documents, then its documents, oldest first. Empty when there is none yet.',
      ),
  })
  .describe('The changes of this repository.');

export function listChangesTool(
  listChanges: Handler<void, ChangeWithEntries[]>,
): ToolRegistration {
  return defineTool(
    LIST_CHANGES,
    {
      title: 'List changes',
      description:
        'Lists every change in the repository, newest first, each with its id, name, tracker key, type and status, and the ids of its design documents and documents. Use it to find the id of a change the user refers to by name or key, the id of a design document or document to update, or to offer the user the changes to choose from.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async () => listed(await listChanges.handle()),
  );
}

function listed(changes: ChangeWithEntries[]): CallToolResult {
  return success(summary(changes), { changes });
}

/** The ids are in the text too, for hosts and models that read only that. */
function summary(changes: ChangeWithEntries[]): string {
  if (changes.length === 0) {
    return `There are no changes yet. Create one with ${CREATE_CHANGE}.`;
  }
  const count = changes.length === 1 ? '1 change' : `${changes.length} changes`;
  return [`${count}, newest first:`, ...changes.flatMap(lines)].join('\n');
}

function lines(change: ChangeWithEntries): string[] {
  const key = change.key === '' ? '' : ` [${change.key}]`;
  return [
    `- ${change.id}${key}: ${change.name} (${change.type}, ${change.status})`,
    ...change.entries.map(entryLine),
  ];
}

function entryLine(entry: ChangeEntry): string {
  if (entry.kind === 'document') {
    return `  - document ${entry.id}: ${entry.name}`;
  }
  const state = entry.implemented ? 'implemented' : 'not implemented';
  return `  - design document ${entry.id}: ${entry.name} (${state})`;
}
