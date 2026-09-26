import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { AddDesignDocToChange } from '#backend/app/changes/add-design-doc-to-change';
import { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import type { Handler } from '#backend/app/handler';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  ADD_DESIGN_DOC_TO_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { DESIGN_DOC_SHAPE } from './design-doc-shape';
import { NO_ID, fromWorkingFile, inChangeInput } from './working-file';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummary })
  .describe('The design document as stored, with the id the server minted.');

export function addDesignDocToChangeTool(
  addDesignDoc: Handler<AddDesignDocToChange, DesignDocSummary>,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    ADD_DESIGN_DOC_TO_CHANGE,
    {
      title: 'Add design document to change',
      description: `Adds a design document to a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. The server mints its id, a UUID, and every call adds a new design document, so revise one you added with ${UPDATE_DESIGN_DOC_IN_CHANGE}. Write the design document to a JSON working file under the session scratch directory and pass its path.`,
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
        AddDesignDocToChange.shape.designDoc,
        SUBJECT,
        input.path,
        async (file) => {
          const designDoc = await addDesignDoc.handle({
            change: input.change,
            designDoc: file,
          });
          return success(
            `Added design document ${designDoc.id} ("${designDoc.name}") to ${input.change}. Refer to it by this id.`,
            { designDoc },
          );
        },
      ),
  );
}
