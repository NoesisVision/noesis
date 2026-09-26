import type { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { ChangeId } from '#backend/app/changes/change-id';
import {
  DesignDocumentContent,
  type DesignDocViolation,
} from '#backend/app/design-docs/design-doc';
import {
  type DesignDocSummary,
  DesignDocSummarySchema,
  type DesignDocsService,
  InvalidDesignDocError,
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
      withChange(input.change, SUBJECT, (change) =>
        create(designDocs, files, change, input.path),
      ),
  );
}

async function create(
  designDocs: DesignDocsService,
  files: SessionFiles,
  change: ChangeId,
  path: string,
): Promise<CallToolResult> {
  const document = await files.read(DesignDocumentContent, path);
  if (document.isErr()) {
    return failure(`Invalid ${SUBJECT}:\n${document.error}`);
  }
  try {
    return created(change, await designDocs.create(change, document.value));
  } catch (error) {
    if (error instanceof InvalidDesignDocError) return violationsFailure(error);
    throw error;
  }
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
