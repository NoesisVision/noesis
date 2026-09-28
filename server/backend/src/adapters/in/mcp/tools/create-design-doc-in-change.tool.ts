import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { DesignDocumentContent } from '#backend/app/design-docs/design-doc';
import {
  DesignDocSummarySchema,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DESIGN_DOC_IN_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { DESIGN_DOC_SHAPE } from './design-doc-shape';
import { fromWorkingFile, inChangeInput, NO_ID } from './working-file';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummarySchema })
  .describe('The design document as stored, with the id the server minted.');

export function createDesignDocInChangeTool(
  designDocs: DesignDocsService,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    CREATE_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Create design document in change',
      description: `Creates a design document in a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. The server mints its id from today's date and the name, and every call creates a new design document, so revise one you created with ${UPDATE_DESIGN_DOC_IN_CHANGE}. Write the design document to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        `${DESIGN_DOC_SHAPE} ${NO_ID}`,
      ),
      outputSchema,
      annotations: CREATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        DesignDocumentContent,
        SUBJECT,
        input.path,
        async (file) => {
          const designDoc = await designDocs.create(input.change, file);
          return success(
            `Created design document ${designDoc.id} ("${designDoc.name}") in ${input.change}. Refer to it by this id.`,
            { designDoc },
          );
        },
      ),
  );
}
