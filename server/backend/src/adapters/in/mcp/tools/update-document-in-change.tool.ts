import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import { UpdateDocumentInChange } from '#backend/app/changes/update-document-in-change';
import type { Handler } from '#backend/app/handler';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  ADD_DOCUMENT_TO_CHANGE,
  LIST_CHANGES,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { fromWorkingFile, inChangeInput } from './working-file';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: SourceDocumentSummary })
  .describe('The document as stored.');

export function updateDocumentInChangeTool(
  updateDocument: Handler<UpdateDocumentInChange, SourceDocumentSummary>,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_DOCUMENT_IN_CHANGE,
    {
      title: 'Update document in change',
      description: `Replaces an existing document of a change whole. The id stays as it was, even when the title changes. Never adds a document; use ${ADD_DOCUMENT_TO_CHANGE} for that. Write the document to a JSON working file under the session scratch directory and pass its path with the document's id.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        '{ "title", "date", "content" }, without "id".',
      ).extend({
        id: SourceDocumentId.describe(
          `The id of the document to update, as ${ADD_DOCUMENT_TO_CHANGE} answered it or ${LIST_CHANGES} lists it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        UpdateDocumentInChange.shape.document,
        SUBJECT,
        input.path,
        async (file) => {
          const document = await updateDocument.handle({
            change: input.change,
            id: input.id,
            document: file,
          });
          return success(
            `Updated document ${document.id} ("${document.title}") in ${input.change}.`,
            { document },
          );
        },
      ),
  );
}
