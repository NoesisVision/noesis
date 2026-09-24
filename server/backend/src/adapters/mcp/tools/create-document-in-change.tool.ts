import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DocumentContentSchema } from '#backend/app/information-sources/document';
import {
  type DocumentsService,
  type DocumentSummary,
  DocumentSummarySchema,
} from '#backend/app/information-sources/documents.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DOCUMENT_IN_CHANGE,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import { NO_ID, inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: DocumentSummarySchema })
  .describe('The document as stored, with the id the server minted.');

export function createDocumentInChangeTool(
  documents: DocumentsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    CREATE_DOCUMENT_IN_CHANGE,
    {
      title: 'Create document in change',
      description: `Creates a document in a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. The server mints its id from today's date and the title, and every call creates a new document, so revise one you created with ${UPDATE_DOCUMENT_IN_CHANGE}. Write the document to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: inChangeInput(
        session,
        SUBJECT,
        `{ "title", "date", "content" }. ${NO_ID}`,
      ),
      outputSchema,
      annotations: CREATE,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        create(documents, session, change, input.path),
      ),
  );
}

async function create(
  documents: DocumentsService,
  session: SessionDir,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await readWorkingFile(session, DocumentContentSchema, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  return created(change, await documents.create(change, document.value));
}

function created(change: ChangeId, document: DocumentSummary): CallToolResult {
  return success(
    `Created document ${document.id} ("${document.title}") in ${change}. Refer to it by this id.`,
    { document },
  );
}
