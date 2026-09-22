import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ChangeNotFound } from '#backend/app/changes/change-errors';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { CreateDocumentSchema } from '#backend/app/information-sources/document';
import type { DuplicateDocument } from '#backend/app/information-sources/document-errors';
import {
  type DocumentsService,
  type DocumentSummary,
  DocumentSummarySchema,
} from '#backend/app/information-sources/documents.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { APPEND, defineTool, type ToolRegistration } from '../tool';
import { ADD_DOCUMENT_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { addToChangeInput, noSuchChange, withSlug } from './change-scoped';

const SUBJECT = 'document';

export function addDocumentToChangeTool(
  documents: DocumentsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    ADD_DOCUMENT_TO_CHANGE,
    {
      title: 'Add document to change',
      description:
        'Adds a document to a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. The title identifies the document within its change. Write the document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: addToChangeInput(
        session,
        SUBJECT,
        '{ "title", "date", "content" }.',
      ),
      outputSchema: DocumentSummarySchema.describe(
        'Where the document now lives.',
      ),
      annotations: APPEND,
    },
    (input) =>
      withSlug(input.change, (slug) =>
        add(documents, session, slug, input.path),
      ),
  );
}

async function add(
  documents: DocumentsService,
  session: SessionDir,
  slug: ChangeSlug,
  path: string,
): Promise<CallToolResult> {
  // The shape is the whole contract: the title's pattern guarantees an id.
  const document = await readWorkingFile(session, CreateDocumentSchema, path);
  if (document.isErr()) {
    return failure(formatReport(SUBJECT, document.error));
  }

  return documents
    .create(slug, document.value)
    .match((summary) => added(slug, summary), refused);
}

function added(slug: ChangeSlug, summary: DocumentSummary): CallToolResult {
  return success(
    `Added "${summary.title}" to ${slug.value} as ${summary.id}, stored at ${summary.path}.`,
    summary,
  );
}

function refused(error: ChangeNotFound | DuplicateDocument): CallToolResult {
  switch (error.kind) {
    case 'change-not-found':
      return noSuchChange(error, SUBJECT);
    case 'duplicate-document':
      return failure(
        error.message,
        'Give this document a different title, or update the existing one.',
      );
  }
}
