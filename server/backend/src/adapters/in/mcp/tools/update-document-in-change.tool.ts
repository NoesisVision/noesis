import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { DocumentContentSchema } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import {
  type DocumentsService,
  DocumentSummarySchema,
} from '#backend/app/information-sources/documents.service';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DOCUMENT_IN_CHANGE,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { fromWorkingFile, inChangeInput } from './working-file';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: DocumentSummarySchema })
  .describe('The document as stored.');

export function updateDocumentInChangeTool(
  documents: DocumentsService,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_DOCUMENT_IN_CHANGE,
    {
      title: 'Update document in change',
      description: `Replaces an existing document of a change whole. The id stays as it was, even when the title changes. Never creates a document; use ${CREATE_DOCUMENT_IN_CHANGE} for that. Write the document to a JSON working file under the session scratch directory and pass its path with the document's id.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        '{ "title", "date", "content" }, without "id".',
      ).extend({
        id: DocumentId.describe(
          `The id of the document to update, as ${CREATE_DOCUMENT_IN_CHANGE} answered it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        DocumentContentSchema,
        SUBJECT,
        input.path,
        async (file) => {
          const document = await documents.update(input.change, input.id, file);
          return success(
            `Updated document ${document.id} ("${document.title}") in ${input.change}.`,
            { document },
          );
        },
      ),
  );
}
