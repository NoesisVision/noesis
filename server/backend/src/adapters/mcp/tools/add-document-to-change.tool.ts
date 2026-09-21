import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { CreateDocumentSchema } from '#backend/app/information-sources/document';
import {
  type DocumentsService,
  type DocumentSummary,
  DuplicateDocumentError,
} from '#backend/app/information-sources/documents.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { logged } from '../tool-handler';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { CREATE_CHANGE } from './create-change.tool';

const ADD_DOCUMENT_TO_CHANGE = 'add_document_to_change';

// The slug is a plain string here on purpose: whether it names a change is
// domain knowledge, answered in-band, so the shape check adds nothing. The
// scratch directory is named here rather than in the server's instructions
// because this description is served by the process that owns it.
const inputSchemaFor = (session: SessionDir) =>
  z
    .object({
      change: z
        .string()
        .describe(
          'The slug of the change the document belongs to, as create_change returned it or list_changes lists it, e.g. "payment-retry".',
        ),
      path: z
        .string()
        .describe(
          `Path to a JSON working file holding { "title", "date", "content" }. Write it yourself into this session's scratch directory, ${session.path}, which is deleted when the session ends; any path under .noesis/tmp/ is accepted. The document text never travels in this call.`,
        ),
    })
    .describe('The change to add to, and where its document is written.');

type AddDocumentInput = z.infer<ReturnType<typeof inputSchemaFor>>;

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

export function registerAddDocumentToChange(
  server: McpServer,
  documents: DocumentsService,
  session: SessionDir,
): void {
  server.registerTool(
    ADD_DOCUMENT_TO_CHANGE,
    {
      title: 'Add document to change',
      description:
        'Adds a document to a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. The title identifies the document within its change. Write the document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: inputSchemaFor(session),
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    logged(ADD_DOCUMENT_TO_CHANGE, (input: AddDocumentInput) =>
      add(documents, session, input),
    ),
  );
}

async function add(
  documents: DocumentsService,
  session: SessionDir,
  input: AddDocumentInput,
): Promise<CallToolResult> {
  const slug = ChangeSlug.tryParse(input.change);
  if (slug === null) return notASlug(input.change);

  // The shape is the whole contract: the title's pattern guarantees an id,
  // so a document has no whole-document `check`.
  const report = await readWorkingFile(
    session,
    { schema: CreateDocumentSchema },
    input.path,
  );
  if (!report.ok) return failure(formatReport('document', report));

  try {
    return added(slug, await documents.create(slug, report.value));
  } catch (error) {
    if (error instanceof ChangeNotFoundError) return noSuchChange(error);
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

function notASlug(value: string): CallToolResult {
  return failure(
    `${JSON.stringify(value)} is not a change slug.`,
    'A slug is lower-case kebab-case, as create_change returned it, e.g. "payment-retry".',
  );
}

function noSuchChange(error: ChangeNotFoundError): CallToolResult {
  return failure(
    error.message,
    `Create it with ${CREATE_CHANGE} first, then add the document to the slug it returns.`,
  );
}

function duplicate(error: DuplicateDocumentError): CallToolResult {
  return failure(
    error.message,
    'Give this document a different title, or update the existing one.',
  );
}
