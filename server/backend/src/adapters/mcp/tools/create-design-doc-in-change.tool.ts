import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionDir } from '#backend/adapters/mcp/session-dir';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentContentSchema } from '#backend/app/design-docs/design-doc';
import {
  type DesignDocSummary,
  DesignDocSummarySchema,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  CREATE_DESIGN_DOC_IN_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { NO_ID, inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'design document';

/** The working file, as both design-document tools describe it. */
export const DESIGN_DOC_SHAPE =
  '{ "name", "description", "modules", "buildingBlocks", "behaviours" }, each field a { "value", "reviewedByHuman" } pair and each collection a change set of { "added", "removed", "modified" }.';

const outputSchema = z
  .object({ designDoc: DesignDocSummarySchema })
  .describe('The design document as stored, with the id the server minted.');

export function createDesignDocInChangeTool(
  designDocs: DesignDocsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    CREATE_DESIGN_DOC_IN_CHANGE,
    {
      title: 'Create design document in change',
      description: `Creates a design document in a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. The server mints its id from today's date and the name, and every call creates a new design document, so revise one you created with ${UPDATE_DESIGN_DOC_IN_CHANGE}. Write the design document to a JSON working file under the session scratch directory and pass its path.`,
      inputSchema: inChangeInput(
        session,
        SUBJECT,
        `${DESIGN_DOC_SHAPE} ${NO_ID}`,
      ),
      outputSchema,
      annotations: CREATE,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        create(designDocs, session, change, input.path),
      ),
  );
}

async function create(
  designDocs: DesignDocsService,
  session: SessionDir,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await session.readWorkingFile(
    DesignDocumentContentSchema,
    path,
  );
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  return created(change, await designDocs.create(change, document.value));
}

function created(
  change: ChangeId,
  designDoc: DesignDocSummary,
): CallToolResult {
  return success(
    `Created design document ${designDoc.id} ("${designDoc.name}") in ${change}. Refer to it by this id.`,
    { designDoc },
  );
}
