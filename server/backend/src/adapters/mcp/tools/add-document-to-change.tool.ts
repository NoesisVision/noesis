import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DocumentSchema } from '#backend/app/information-sources/document';
import {
  type DocumentsService,
  type DocumentSummary,
  DocumentSummarySchema,
} from '#backend/app/information-sources/documents.service';
import { formatReport } from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { UPSERT, defineTool, type ToolRegistration } from '../tool';
import { ADD_DOCUMENT_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import {
  addToChangeInput,
  createdOrUpdated,
  idInstructions,
  withChange,
} from './change-scoped';

const SUBJECT = 'document';

const outputSchema = z
  .object({
    document: DocumentSummarySchema,
    created: z
      .boolean()
      .describe(
        'true when the id was new in the change; false when an existing document was updated in place.',
      ),
  })
  .describe('The document as stored, and whether it was created or updated.');

export function addDocumentToChangeTool(
  documents: DocumentsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    ADD_DOCUMENT_TO_CHANGE,
    {
      title: 'Add document to change',
      description:
        'Adds a document to a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. A document whose id is already in the change is updated in place; the answer says whether it was created or updated. Write the document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: addToChangeInput(
        session,
        SUBJECT,
        `{ "id", "title", "date", "content" }. ${idInstructions(SUBJECT, 'title')}`,
      ),
      outputSchema,
      annotations: UPSERT,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        add(documents, session, change, input.path),
      ),
  );
}

async function add(
  documents: DocumentsService,
  session: SessionDir,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await readWorkingFile(session, DocumentSchema, path);
  if (document.isErr()) {
    return failure(formatReport(SUBJECT, document.error));
  }
  const { value, created } = await documents.add(change, document.value);
  return added(change, value, created);
}

function added(
  change: ChangeId,
  document: DocumentSummary,
  created: boolean,
): CallToolResult {
  return success(
    `${createdOrUpdated(created)} document ${document.id} ("${document.title}") in ${change}.`,
    { document, created },
  );
}
