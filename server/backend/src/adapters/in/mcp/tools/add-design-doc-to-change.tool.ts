import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { AddDesignDocToChange } from '#backend/app/changes/add-design-doc-to-change';
import type { ChangeId } from '#backend/app/changes/model/change-id';
import type { DesignDocViolation } from '#backend/app/changes/model/design-doc';
import { DesignDocSummary } from '#backend/app/changes/model/design-doc-summary';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import type { Handler } from '#backend/app/handler';
import { CREATE, defineTool, type ToolRegistration } from '../tool';
import {
  ADD_DESIGN_DOC_TO_CHANGE,
  UPDATE_DESIGN_DOC_IN_CHANGE,
} from '../tool-names';
import { failure, success } from '../tool-result';
import { NO_ID, inChangeInput, withChange } from './change-scoped';

const SUBJECT = 'design document';

/** The working file, as both design-document tools describe it. */
export const DESIGN_DOC_SHAPE =
  '{ "name", "description", "modules", "buildingBlocks", "behaviours" }. A field is { "value", "author" } when the design changes it, { "changed": false } or absent when it does not; each collection is a change set of { "added", "removed", "modified" }. Write every field as the agent: leave "author" out. Nothing is scanned yet, so a design only adds, at every level.';

const FIXES: Record<DesignDocViolation['reason'], string> = {
  changedInGreenField:
    'nothing is scanned yet, so a design only adds; add this instead',
  unknownElement:
    'the scanned model has no such element or part; add it instead of modifying or removing it',
  unchangedFieldInAddedItem:
    'the item is new, so this field needs a { "value" }',
  humanAuthor: 'write every field as the agent: leave "author" out',
};

/** The answer to a design document that breaks its rules, one line per field to fix. */
export function violationsFailure(
  error: InvalidDesignDocError,
): CallToolResult {
  return failure(
    `Invalid ${SUBJECT}; fix each field and call again:`,
    error.violations
      .map(({ path, reason }) => `- ${path}: ${FIXES[reason]}`)
      .join('\n'),
  );
}

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
      withChange(input.change, SUBJECT, (change) =>
        add(addDesignDoc, files, change, input.path),
      ),
  );
}

async function add(
  addDesignDoc: Handler<AddDesignDocToChange, DesignDocSummary>,
  files: SessionFiles,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await files.read(AddDesignDocToChange.shape.designDoc, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  try {
    return added(
      change,
      await addDesignDoc.handle({ change, designDoc: document.value }),
    );
  } catch (error) {
    if (error instanceof InvalidDesignDocError) return violationsFailure(error);
    throw error;
  }
}

function added(change: ChangeId, designDoc: DesignDocSummary): CallToolResult {
  return success(
    `Added design document ${designDoc.id} ("${designDoc.name}") to ${change}. Refer to it by this id.`,
    { designDoc },
  );
}
