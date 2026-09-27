import { z } from 'zod';
import {
  type ChangeEntry,
  ChangeWithEntries,
} from '#backend/app/changes/model/change-entry';
import type { NoesisApi } from '#mcp/api/noesis-api';
import { defineTool, READ_ONLY, type ToolRegistration } from '#mcp/server/tool';
import { CREATE_CHANGE, LIST_CHANGES } from '#mcp/server/tool-names';

const inputSchema = z
  .object({})
  .describe('Nothing to pass: the list is every change in the repository.');

const outputSchema = z
  .object({
    changes: z
      .array(ChangeWithEntries)
      .describe(
        'Every change by id descending — newest day first, changes of one day by name — each with its design documents, then its source documents, oldest first. Empty when there is none yet.',
      ),
  })
  .describe('The changes of this repository.');

export function listChangesTool(api: NoesisApi): ToolRegistration {
  return defineTool(
    LIST_CHANGES,
    {
      title: 'List changes',
      description:
        'Lists every change in the repository by id descending, so newest day first, each with its id, name, tracker key, type and status, and the ids of its design documents and source documents. Use it to find the id of a change the user refers to by name or key, the id of a design document or source document to update, or to offer the user the changes to choose from.',
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async () => {
      const { changes } = await api.changes.$get();
      return { summary: summary(changes), structuredContent: { changes } };
    },
  );
}

/** The ids are in the text too, for hosts and models that read only that. */
function summary(changes: ChangeWithEntries[]): string {
  if (changes.length === 0) {
    return `There are no changes yet. Create one with ${CREATE_CHANGE}.`;
  }
  const count = changes.length === 1 ? '1 change' : `${changes.length} changes`;
  return [`${count}, newest day first:`, ...changes.flatMap(lines)].join('\n');
}

function lines(change: ChangeWithEntries): string[] {
  const key = change.key === '' ? '' : ` [${change.key}]`;
  return [
    `- ${change.id}${key}: ${change.name} (${change.type}, ${change.status})`,
    ...change.entries.map(entryLine),
  ];
}

function entryLine(entry: ChangeEntry): string {
  if (entry.kind === 'source-document') {
    return `  - source document ${entry.id}: ${entry.title}`;
  }
  const state = entry.implemented ? 'implemented' : 'not implemented';
  return `  - design document ${entry.id}: ${entry.name} (${state})`;
}
