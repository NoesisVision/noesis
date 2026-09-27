import { z } from 'zod';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import {
  UpdateSourceDocumentInChange,
  type UpdateSourceDocumentInChangeHandler,
} from '#backend/app/changes/update-source-document-in-change';
import { UPDATE, defineTool, type ToolRegistration } from '#mcp/server/tool';
import {
  ADD_SOURCE_DOCUMENT_TO_CHANGE,
  LIST_CHANGES,
  UPDATE_SOURCE_DOCUMENT_IN_CHANGE,
} from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';
import { inChangeInput } from './working-file';

const SUBJECT = 'source document';

const outputSchema = z
  .object({ sourceDocument: SourceDocumentSummary })
  .describe('The source document as stored.');

export function updateSourceDocumentInChangeTool(
  updateSourceDocument: UpdateSourceDocumentInChangeHandler,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_SOURCE_DOCUMENT_IN_CHANGE,
    {
      title: 'Update source document in change',
      description: `Replaces an existing source document of a change whole. The id stays as it was, even when the title changes. Never adds a source document; use ${ADD_SOURCE_DOCUMENT_TO_CHANGE} for that. Write the source document to a JSON working file under the session scratch directory and pass its path with the source document's id.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        '{ "title", "date", "content" }, without "id".',
      ).extend({
        id: SourceDocumentId.describe(
          `The id of the source document to update, as ${ADD_SOURCE_DOCUMENT_TO_CHANGE} answered it or ${LIST_CHANGES} lists it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    async (input) => {
      const file = await files.read(
        SUBJECT,
        UpdateSourceDocumentInChange.shape.sourceDocument,
        input.path,
      );
      const sourceDocument = await updateSourceDocument.handle({
        change: input.change,
        id: input.id,
        sourceDocument: file,
      });
      return {
        summary: `Updated source document ${sourceDocument.id} ("${sourceDocument.title}") in ${input.change}.`,
        structuredContent: { sourceDocument },
      };
    },
  );
}
