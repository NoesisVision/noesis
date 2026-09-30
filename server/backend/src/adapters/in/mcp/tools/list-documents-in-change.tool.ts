import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type DocumentSummary,
  DocumentSummarySchema,
} from '#backend/app/information-sources/document-summary';
import type { ListDocumentsInChangeHandler } from '#backend/app/information-sources/list-documents-in-change';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import {
  CREATE_DOCUMENT_IN_CHANGE,
  GET_DOCUMENT_IN_CHANGE,
  LIST_CHANGES,
  LIST_DOCUMENTS_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({
    change: ChangeId.describe(
      `The id of the change, as ${LIST_CHANGES} lists it, e.g. "2026-09-24-payment-retry".`,
    ),
  })
  .describe('The change whose documents to list.');

const outputSchema = z
  .object({
    documents: z
      .array(DocumentSummarySchema)
      .describe(
        'Every document of the change, oldest first, without its content. Empty when there is none yet.',
      ),
  })
  .describe('The documents of one change.');

export function listDocumentsInChangeTool(
  listDocuments: ListDocumentsInChangeHandler,
): ToolRegistration {
  return defineTool(
    LIST_DOCUMENTS_IN_CHANGE,
    {
      title: 'List documents in change',
      description: `Lists the documents of a change — the source material it is informed by — oldest first, each with its id, title and date but not its content; read one whole with ${GET_DOCUMENT_IN_CHANGE}.`,
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async ({ change }) =>
      listed(change, await listDocuments.handle({ change })),
  );
}

function listed(
  change: ChangeId,
  documents: DocumentSummary[],
): CallToolResult {
  return success(summary(change, documents), { documents });
}

/** The ids are in the text too, for hosts and models that read only that. */
function summary(change: ChangeId, documents: DocumentSummary[]): string {
  if (documents.length === 0) {
    return `Change ${change} has no documents yet. Add one with ${CREATE_DOCUMENT_IN_CHANGE}.`;
  }
  const count =
    documents.length === 1 ? '1 document' : `${documents.length} documents`;
  return [`${count} in ${change}, oldest first:`, ...documents.map(line)].join(
    '\n',
  );
}

function line(document: DocumentSummary): string {
  return `- ${document.id}: ${document.title} (${document.date})`;
}
