import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { FindDocumentHandler } from '#backend/app/information-sources/find-document';
import { defineTool, READ_ONLY, type ToolRegistration } from '../tool';
import {
  GET_DOCUMENT_IN_CHANGE,
  LIST_CHANGES,
  LIST_DOCUMENTS_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';

const inputSchema = z
  .object({
    change: ChangeId.describe(
      `The id of the change the document belongs to, as ${LIST_CHANGES} lists it, e.g. "2026-09-24-payment-retry".`,
    ),
    id: DocumentId.describe(
      `The id of the document, as ${LIST_DOCUMENTS_IN_CHANGE} lists it.`,
    ),
  })
  .describe('The document to read, and the change it is in.');

const outputSchema = z
  .object({ document: DocumentSchema })
  .describe('The document, whole: its content verbatim.');

export function getDocumentInChangeTool(
  findDocument: FindDocumentHandler,
): ToolRegistration {
  return defineTool(
    GET_DOCUMENT_IN_CHANGE,
    {
      title: 'Get document in change',
      description: `Answers with one document of a change, whole: its id, title, date and content, verbatim. Find the id with ${LIST_DOCUMENTS_IN_CHANGE}.`,
      inputSchema,
      outputSchema,
      annotations: READ_ONLY,
    },
    async (input) => found(input.change, await findDocument.handle(input)),
  );
}

function found(change: ChangeId, document: Document): CallToolResult {
  return success(
    `Document ${document.id} ("${document.title}", ${document.date}) in ${change}: ${document.content.length} characters.`,
    { document },
  );
}
