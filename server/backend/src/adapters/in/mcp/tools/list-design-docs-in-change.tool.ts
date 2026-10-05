import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type DesignDocSummary,
  DesignDocSummarySchema,
} from '#backend/app/design-docs/design-doc-summary';
import type { ListDesignDocsInChangeHandler } from '#backend/app/design-docs/list-design-docs-in-change';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import {
  CREATE_DESIGN_DOC_IN_CHANGE,
  GET_DESIGN_DOC_IN_CHANGE,
  LIST_CHANGES,
  LIST_DESIGN_DOCS_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({
    change: ChangeId.describe(
      `The id of the change, as ${LIST_CHANGES} lists it, e.g. "2026-09-24-payment-retry".`,
    ),
  })
  .describe('The change whose design documents to list.');

const outputSchema = z
  .object({
    designDocs: z
      .array(DesignDocSummarySchema)
      .describe(
        'Every design document of the change, oldest first, without its content. Empty when there is none yet.',
      ),
  })
  .describe('The design documents of one change.');

export function listDesignDocsInChangeTool(
  listDesignDocs: ListDesignDocsInChangeHandler,
): ToolRegistration {
  return defineTool(
    LIST_DESIGN_DOCS_IN_CHANGE,
    {
      title: 'List design documents in change',
      description: `Lists the design documents of a change — what the change does to the model — oldest first, each with its id, name and whether it is marked implemented, but not its content; read one whole with ${GET_DESIGN_DOC_IN_CHANGE}.`,
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async ({ change }) =>
      listed(change, await listDesignDocs.handle({ change })),
  );
}

function listed(
  change: ChangeId,
  designDocs: DesignDocSummary[],
): CallToolResult {
  return success(summary(change, designDocs), { designDocs });
}

/** The ids are in the text too, for hosts and models that read only that. */
function summary(change: ChangeId, designDocs: DesignDocSummary[]): string {
  if (designDocs.length === 0) {
    return `Change ${change} has no design documents yet. Create one with ${CREATE_DESIGN_DOC_IN_CHANGE}.`;
  }
  const count =
    designDocs.length === 1
      ? '1 design document'
      : `${designDocs.length} design documents`;
  return [`${count} in ${change}, oldest first:`, ...designDocs.map(line)].join(
    '\n',
  );
}

function line(designDoc: DesignDocSummary): string {
  const implemented = designDoc.implemented ? ' (implemented)' : '';
  return `- ${designDoc.id}: ${designDoc.name}${implemented}`;
}
