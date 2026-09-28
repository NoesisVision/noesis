import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DesignDocSummarySchema } from '#backend/app/design-docs/design-doc-summary';
import {
  UpdateDesignDocInChange,
  type UpdateDesignDocInChangeHandler,
} from '#backend/app/design-docs/update-design-doc-in-change';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DESIGN_DOC_IN_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { success } from '../tool-result';
import { DESIGN_DOC_SHAPE } from './design-doc-shape';
import { fromWorkingFile, inChangeInput } from './working-file';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummarySchema })
  .describe('The design document as stored.');

export function updateDesignDocInChangeTool(
  updateDesignDoc: UpdateDesignDocInChangeHandler,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Update design document in change',
      description: `Replaces an existing design document of a change whole. The id stays as it was, even when the name changes. Never creates a design document; use ${CREATE_DESIGN_DOC_IN_CHANGE} for that. Write the design document to a JSON working file under the session scratch directory and pass its path with the design document's id.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        `${DESIGN_DOC_SHAPE} Without "id".`,
      ).extend({
        id: DesignDocId.describe(
          `The id of the design document to update, as ${CREATE_DESIGN_DOC_IN_CHANGE} answered it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    (input) =>
      fromWorkingFile(
        files,
        UpdateDesignDocInChange.shape.designDoc,
        SUBJECT,
        input.path,
        async (file) => {
          const designDoc = await updateDesignDoc.handle({
            change: input.change,
            id: input.id,
            designDoc: file,
            writer: 'agent',
          });
          return success(
            `Updated design document ${designDoc.id} ("${designDoc.name}") in ${input.change}.`,
            { designDoc },
          );
        },
      ),
  );
}
