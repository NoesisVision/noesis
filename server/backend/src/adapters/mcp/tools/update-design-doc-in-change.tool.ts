import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionDir } from '#backend/adapters/mcp/session-dir';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentContentSchema } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import {
  DesignDocNotFoundError,
  type DesignDocSummary,
  DesignDocSummarySchema,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { UPDATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DESIGN_DOC_IN_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { inChangeInput, withChange } from './change-scoped';
import { DESIGN_DOC_SHAPE } from './create-design-doc-in-change.tool';

const SUBJECT = 'design document';

const outputSchema = z
  .object({ designDoc: DesignDocSummarySchema })
  .describe('The design document as stored.');

export function updateDesignDocInChangeTool(
  designDocs: DesignDocsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    UPDATE_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Update design document in change',
      description: `Replaces an existing design document of a change whole. The id stays as it was, even when the name changes. Never creates a design document; use ${CREATE_DESIGN_DOC_IN_CHANGE} for that. Write the design document to a JSON working file under the session scratch directory and pass its path with the design document's id.`,
      inputSchema: inChangeInput(
        session,
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
      withChange(input.change, SUBJECT, (change) =>
        update(designDocs, session, change, input.id, input.path),
      ),
  );
}

async function update(
  designDocs: DesignDocsService,
  session: SessionDir,
  change: ChangeId,
  id: DesignDocId,
  path: string,
): Promise<CallToolResult> {
  const document = await session.readWorkingFile(
    DesignDocumentContentSchema,
    path,
  );
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  try {
    return updated(change, await designDocs.update(change, id, document.value));
  } catch (error) {
    if (error instanceof DesignDocNotFoundError) {
      return failure(
        error.message,
        `Pass the id ${CREATE_DESIGN_DOC_IN_CHANGE} answered with, or create the design document with it.`,
      );
    }
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
