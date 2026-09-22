import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { type Change, ChangeSchema } from '#backend/app/changes/change';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import { CREATE_CHANGE, LIST_CHANGES } from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({})
  .describe('Nothing to pass: the list is every change in the repository.');

const outputSchema = z
  .object({
    changes: z
      .array(ChangeSchema)
      .describe('Every change, newest first. Empty when there is none yet.'),
  })
  .describe('The changes of this repository.');

export function listChangesTool(changes: ChangesService): ToolRegistration {
  return defineTool(
    LIST_CHANGES,
    {
      title: 'List changes',
      description:
        'Lists every change in the repository, newest first, each with its slug, name, tracker key, type and status. Use it to find the slug of a change the user refers to by name or key, or to offer the user the changes to choose from.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async () => listed(await changes.list()),
  );
}

function listed(changes: Change[]): CallToolResult {
  return success(summary(changes), { changes });
}

/** The slugs are in the text too, for hosts and models that read only that. */
function summary(changes: Change[]): string {
  if (changes.length === 0) {
    return `There are no changes yet. Create one with ${CREATE_CHANGE}.`;
  }
  const count = changes.length === 1 ? '1 change' : `${changes.length} changes`;
  return [`${count}, newest first:`, ...changes.map(line)].join('\n');
}

function line(change: Change): string {
  const key = change.key === '' ? '' : ` [${change.key}]`;
  return `- ${change.slug}${key}: ${change.name} (${change.type}, ${change.status})`;
}
