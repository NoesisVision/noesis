import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { DocumentContentSchema } from '#backend/app/information-sources/document';
import {
  type DocumentsService,
  DocumentSummarySchema,
} from '#backend/app/information-sources/documents.service';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DOCUMENT_IN_CHANGE,
  UPDATE_DOCUMENT_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { fromWorkingFile, inChangeInput, NO_ID } from './working-file';

const SUBJECT = 'document';

const outputSchema = z
  .object({ document: DocumentSummarySchema })
  .describe('The document as stored, with the id the server minted.');

export function createDocumentInChangeTool(
  documents: DocumentsService,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    CREATE_DOCUMENT_IN_CHANGE,
    {
      title: 'Create document in change',
      description: `Creates a document in a change: a piece of source material the change is informed by — a transcript, a spec, a note, a page of research. The server mints its id from today's date and the title, and every call creates a new document, so revise one you created with ${UPDATE_DOCUMENT_IN_CHANGE}. Write the document to a JSON working file under the session scratch directory and pass its path.`,
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
        DocumentContentSchema,
        SUBJECT,
        input.path,
        async (file) => {
          const document = await documents.create(input.change, file);
          return success(
            `Created document ${document.id} ("${document.title}") in ${input.change}. Refer to it by this id.`,
            { document },
          );
        },
      ),
  );
}
