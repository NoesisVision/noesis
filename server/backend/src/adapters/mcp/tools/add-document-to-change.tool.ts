import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { CreateDocumentSchema } from '#backend/app/information-sources/document';
import {
  type DocumentsService,
  type DocumentSummary,
  DuplicateDocumentError,
} from '#backend/app/information-sources/documents.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { APPEND, defineTool, type ToolRegistration } from '../tool';
import { ADD_DOCUMENT_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { addToChangeInput, withChange } from './change-scoped';

const SUBJECT = 'document';

const outputSchema = z
  .object({
    id: z
      .string()
      .describe('The document id, derived from the title within the change.'),
    title: z.string().describe('The document title, as stored.'),
    date: z.string().describe('The date on the document, ISO 8601.'),
    path: z
      .string()
      .describe('Absolute path the document was stored at under .noesis/.'),
  })
  .describe('Where the document now lives.');

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
      outputSchema,
      annotations: APPEND,
    },
    (input) =>
      withChange(input.change, SUBJECT, (slug) =>
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
  // The shape is the whole contract: the title's pattern guarantees an id,
  // so a document has no whole-document `check`.
  const report = await readWorkingFile(
    session,
    { schema: CreateDocumentSchema },
    path,
  );
  if (!report.ok) return failure(formatReport(SUBJECT, report));

  try {
    return added(slug, await documents.create(slug, report.value));
  } catch (error) {
    if (error instanceof DuplicateDocumentError) return duplicate(error);
    throw error;
  }
}

function added(slug: ChangeSlug, summary: DocumentSummary): CallToolResult {
  return success(
    `Added "${summary.title}" to ${slug.value} as ${summary.id.value}, stored at ${summary.path}.`,
    { ...summary, id: summary.id.value },
  );
}

function duplicate(error: DuplicateDocumentError): CallToolResult {
  return failure(
    error.message,
    'Give this document a different title, or update the existing one.',
  );
}
