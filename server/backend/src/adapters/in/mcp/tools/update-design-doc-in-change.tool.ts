import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { ChangeId } from '#backend/app/changes/model/change-id';
import { DesignDocId } from '#backend/app/changes/model/design-doc-id';
import { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import { UpdateDesignDocInChange } from '#backend/app/changes/update-design-doc-in-change';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  ADD_DESIGN_DOC_TO_CHANGE,
  LIST_CHANGES,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import {
  DESIGN_DOC_SHAPE,
  violationsFailure,
} from './add-design-doc-to-change.tool';
import { inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummary })
  .describe('The design document as stored.');

export function updateDesignDocInChangeTool(
  updateDesignDoc: Handler<UpdateDesignDocInChange, DesignDocSummary>,
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
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        update(updateDesignDoc, files, change, input.id, input.path),
      ),
  );
}

async function update(
  updateDesignDoc: Handler<UpdateDesignDocInChange, DesignDocSummary>,
  files: SessionFiles,
  change: ChangeId,
  id: DesignDocId,
  path: string,
): Promise<CallToolResult> {
  const document = await files.read(
    UpdateDesignDocInChange.shape.designDoc,
    path,
  );
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  try {
    return updated(
      change,
      await updateDesignDoc.handle({ change, id, designDoc: document.value }),
    );
  } catch (error) {
    // A missing change is `withChange`'s to answer.
    if (error instanceof NotFoundError && error.entity === 'design document') {
      return failure(
        error.message,
        `Find its id with ${LIST_CHANGES}, or add the design document with ${ADD_DESIGN_DOC_TO_CHANGE}.`,
      );
    }
    if (error instanceof InvalidDesignDocError) return violationsFailure(error);
    throw error;
  }
}

function updated(
  change: ChangeId,
  designDoc: DesignDocSummary,
): CallToolResult {
  return success(
    `Updated design document ${designDoc.id} ("${designDoc.name}") in ${change}.`,
    { designDoc },
  );
}
