import { z } from 'zod';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import {
  UpdateDesignDocInChange,
  type UpdateDesignDocInChangeHandler,
} from '#backend/app/changes/update-design-doc-in-change';
import { UPDATE, defineTool, type ToolRegistration } from '#mcp/server/tool';
import {
  ADD_DESIGN_DOC_TO_CHANGE,
  LIST_CHANGES,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '#mcp/server/tool-names';
import type { SessionFiles } from '#mcp/session/session-files';
import { DESIGN_DOC_SHAPE } from './design-doc-shape';
import { inChangeInput } from './working-file';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummary })
  .describe('The design document as stored.');

export function updateDesignDocInChangeTool(
  updateDesignDoc: UpdateDesignDocInChangeHandler,
  files: SessionFiles,
): ToolRegistration {
  return defineTool(
    UPDATE_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Update design document in change',
      description: `Replaces an existing design document of a change whole. The id stays as it was, even when the name changes. Never adds a design document; use ${ADD_DESIGN_DOC_TO_CHANGE} for that. Write the design document to a JSON working file under the session scratch directory and pass its path with the design document's id.`,
      inputSchema: inChangeInput(
        files,
        SUBJECT,
        `${DESIGN_DOC_SHAPE} Without "id".`,
      ).extend({
        id: DesignDocId.describe(
          `The id of the design document to update, as ${ADD_DESIGN_DOC_TO_CHANGE} answered it or ${LIST_CHANGES} lists it.`,
        ),
      }),
      outputSchema,
      annotations: UPDATE,
    },
    async (input) => {
      const file = await files.read(
        SUBJECT,
        UpdateDesignDocInChange.shape.designDoc,
        input.path,
      );
      const designDoc = await updateDesignDoc.handle({
        change: input.change,
        id: input.id,
        designDoc: file,
      });
      return {
        summary: `Updated design document ${designDoc.id} ("${designDoc.name}") in ${input.change}.`,
        structuredContent: { designDoc },
      };
    },
  );
}
