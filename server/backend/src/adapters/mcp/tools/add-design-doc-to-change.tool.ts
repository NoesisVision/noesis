import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import {
  type DesignDocSummary,
  DesignDocSummarySchema,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import type { SessionDir } from '#backend/platform/files/session-dir';
import { UPSERT, defineTool, type ToolRegistration } from '../tool';
import { ADD_DESIGN_DOC_TO_CHANGE } from '../tool-names';
import { failure, success } from '../tool-result';
import { readWorkingFile } from '../working-file';
import {
  addToChangeInput,
  createdOrUpdated,
  idInstructions,
  withChange,
} from './change-scoped';

const SUBJECT = 'design document';

const outputSchema = z
  .object({
    designDoc: DesignDocSummarySchema,
    created: z
      .boolean()
      .describe(
        'true when the id was new in the change; false when an existing design document was updated in place.',
      ),
  })
  .describe(
    'The design document as stored, and whether it was created or updated.',
  );

export function addDesignDocToChangeTool(
  designDocs: DesignDocsService,
  session: SessionDir,
): ToolRegistration {
  return defineTool(
    ADD_DESIGN_DOC_TO_CHANGE,
    {
      title: 'Add design document to change',
      description:
        'Adds a design document to a change: a diff against the scanned model — the modules, building blocks and behaviours the change adds, modifies or removes, each named by the id the scanner gives it. A design document whose id is already in the change is updated in place; the answer says whether it was created or updated. Write the design document to a JSON working file under the session scratch directory and pass its path.',
      inputSchema: addToChangeInput(
        session,
        SUBJECT,
        `{ "id", "name", "description", "modules", "buildingBlocks", "behaviours" }, each field but "id" a { "value", "reviewedByHuman" } pair and each collection a change set of { "added", "removed", "modified" }. ${idInstructions(SUBJECT, 'name')}`,
      ),
      outputSchema,
      annotations: UPSERT,
    },
    (input) =>
      withChange(input.change, SUBJECT, (change) =>
        add(designDocs, session, change, input.path),
      ),
  );
}

async function add(
  designDocs: DesignDocsService,
  session: SessionDir,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await readWorkingFile(session, DesignDocumentSchema, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  const { value, created } = await designDocs.add(change, document.value);
  return added(change, value, created);
}

function added(
  change: ChangeId,
  designDoc: DesignDocSummary,
  created: boolean,
): CallToolResult {
  return success(
    `${createdOrUpdated(created)} design document ${designDoc.id} ("${designDoc.name}") in ${change}.`,
    { designDoc, created },
  );
}
