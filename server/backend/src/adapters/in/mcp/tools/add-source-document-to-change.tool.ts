import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import {
  CREATE,
  defineTool,
  type ToolRegistration,
} from '#backend/adapters/in/mcp/tool';
import {
  ADD_SOURCE_DOCUMENT_TO_CHANGE,
  UPDATE_SOURCE_DOCUMENT_IN_CHANGE,
} from '#backend/adapters/in/mcp/tool-names';
import { success } from '#backend/adapters/in/mcp/tool-result';
import { AddSourceDocumentToChange } from '#backend/app/changes/add-source-document-to-change';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import { NO_ID, fromWorkingFile, inChangeInput } from './working-file';

const SUBJECT = 'source document';

const outputSchema = z
  .object({ sourceDocument: SourceDocumentSummary })
  .describe('The source document as stored, with the id the server minted.');

export function addSourceDocumentToChangeTool(
  addSourceDocument: Handler<AddSourceDocumentToChange, SourceDocumentSummary>,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    ADD_SOURCE_DOCUMENT_TO_CHANGE,
    {
      title: 'Add source document to change',
      description: `Adds a source document to a change: a piece of material the change is informed by — a transcript, a spec, a note, a page of research. The server mints its id, a UUID, and every call adds a new source document, so revise one you added with ${UPDATE_SOURCE_DOCUMENT_IN_CHANGE}. Write the source document to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        `{ "title", "date", "content" }. ${NO_ID}`,
      ),
      outputSchema,
      annotations: CREATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        AddSourceDocumentToChange.shape.sourceDocument,
        SUBJECT,
        input.path,
        async (file) => {
          const sourceDocument = await addSourceDocument.handle({
            change: input.change,
            sourceDocument: file,
          });
          return success(
            `Added source document ${sourceDocument.id} ("${sourceDocument.title}") to ${input.change}. Refer to it by this id.`,
            { sourceDocument },
          );
        },
      ),
  );
}
