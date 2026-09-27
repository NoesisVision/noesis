import { parseResponse } from 'hono/client';
import { z } from 'zod';
import { AddSourceDocumentToChange } from '#backend/app/changes/add-source-document-to-change';
import { SourceDocumentSummary } from '#backend/app/changes/model/source-document-summary';
import type { NoesisApi } from '#mcp/backend/noesis-api';
import { CREATE, defineTool, type ToolRegistration } from '#mcp/server/tool';
import {
  ADD_SOURCE_DOCUMENT_TO_CHANGE,
  UPDATE_SOURCE_DOCUMENT_IN_CHANGE,
} from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';
import { NO_ID, inChangeInput } from './working-file';

const SUBJECT = 'source document';

const outputSchema = z
  .object({ sourceDocument: SourceDocumentSummary })
  .describe('The source document as stored, with the id the server minted.');

export function addSourceDocumentToChangeTool(
  api: NoesisApi,
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
    async (input) => {
      const file = await files.read(
        SUBJECT,
        AddSourceDocumentToChange.shape.sourceDocument,
        input.path,
      );
      const { sourceDocument } = await parseResponse(
        api.changes[':change']['source-documents'].$post({
          param: { change: input.change },
          json: file,
        }),
      );
      return {
        summary: `Added source document ${sourceDocument.id} ("${sourceDocument.title}") to ${input.change}. Refer to it by this id.`,
        structuredContent: { sourceDocument },
      };
    },
  );
}
