import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { AddDocumentToChange } from '#backend/app/changes/add-document-to-change';
import type { ChangeId } from '#backend/app/changes/model/change-id';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  ADD_DOCUMENT_TO_CHANGE,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { NO_ID, inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: SourceDocumentSummary })
  .describe('The document as stored, with the id the server minted.');

export function addDocumentToChangeTool(
  addDocument: Handler<AddDocumentToChange, SourceDocumentSummary>,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    ADD_DOCUMENT_TO_CHANGE,
    {
      title: 'Add document to change',
      description: `Adds a document to a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. The server mints its id, a UUID, and every call adds a new document, so revise one you added with ${UPDATE_DOCUMENT_IN_CHANGE}. Write the document to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        `{ "title", "date", "content" }. ${NO_ID}`,
      ),
      outputSchema,
      annotations: CREATE,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        add(addDocument, files, change, input.path),
      ),
  );
}

async function add(
  addDocument: Handler<AddDocumentToChange, SourceDocumentSummary>,
  files: SessionFiles,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await files.read(AddDocumentToChange.shape.document, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  return added(
    change,
    await addDocument.handle({ change, document: document.value }),
  );
}

function added(
  change: ChangeId,
  document: SourceDocumentSummary,
): CallToolResult {
  return success(
    `Added document ${document.id} ("${document.title}") to ${change}. Refer to it by this id.`,
    { document },
  );
}
