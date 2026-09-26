import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { ChangeId } from '#backend/app/changes/change-id';
import { SourceDocumentId } from '#backend/app/information-sources/source-document-id';
import { SourceDocumentSummary } from '#backend/app/information-sources/source-document-summary';
import {
  UpdateSourceDocument,
  type UpdateSourceDocumentHandler,
} from '#backend/app/information-sources/update-source-document';
import { NotFoundError } from '#backend/app/not-found-error';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DOCUMENT_IN_CHANGE,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: SourceDocumentSummary })
  .describe('The document as stored.');

export function updateDocumentInChangeTool(
  updateDocument: UpdateSourceDocumentHandler,
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
        id: SourceDocumentId.describe(
          `The id of the document to update, as ${CREATE_DOCUMENT_IN_CHANGE} answered it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        update(updateDocument, files, change, input.id, input.path),
      ),
  );
}

async function update(
  updateDocument: UpdateSourceDocumentHandler,
  files: SessionFiles,
  change: ChangeId,
  id: SourceDocumentId,
  path: string,
): Promise<CallToolResult> {
  const document = await files.read(UpdateSourceDocument.shape.document, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  try {
    return updated(
      change,
      await updateDocument.handle({ change, id, document: document.value }),
    );
  } catch (error) {
    // A missing change is `withChange`'s to answer.
    if (error instanceof NotFoundError && error.entity === 'document') {
      return failure(
        error.message,
        `Pass the id ${CREATE_DOCUMENT_IN_CHANGE} answered with, or create the document with it.`,
      );
    }
    throw error;
  }
}

function updated(
  change: ChangeId,
  document: SourceDocumentSummary,
): CallToolResult {
  return success(
    `Updated document ${document.id} ("${document.title}") in ${change}.`,
    { document },
  );
}
