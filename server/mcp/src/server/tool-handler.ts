import type {
  CallToolResult,
  ServerContext,
} from '@modelcontextprotocol/server';
import { ConcurrentModificationError } from '#backend/app/changes/concurrent-modification-error';
import type { DesignDocViolation } from '#backend/app/changes/model/design-doc';
import { InvalidDesignDocError } from '#backend/app/changes/model/invalid-design-doc-error';
import {
  type Entity,
  NotFoundError,
} from '#backend/app/changes/model/not-found-error';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { BackendError } from '#mcp/backend/backend-error';
import { WorkingFileError } from '#mcp/session/working-file-error';
import {
  ADD_DESIGN_DOC_TO_CHANGE,
  ADD_SOURCE_DOCUMENT_TO_CHANGE,
  CREATE_CHANGE,
  LIST_CHANGES,
} from './tool-names';
import { failure } from './tool-result';

const log = serverLogger('mcp');

/**
 * The last resort around a tool. What a tool throws for a caller's mistake —
 * a working file it cannot read, a missing entity, a write that lost a race,
 * a design that breaks its rules — is answered here, once, with what to do next. Anything else the
 * SDK would turn into an in-band error silently, leaving nothing in
 * `.noesis/logs/` for the person whose session just failed; every handler is
 * registered through here, so the server keeps the record and the agent still
 * gets an answer it can read.
 */
export function logged<Input>(
  tool: string,
  handler: (input: Input, ctx: ServerContext) => Promise<CallToolResult>,
): (input: Input, ctx: ServerContext) => Promise<CallToolResult> {
  return async (input, ctx) => {
    try {
      return await handler(input, ctx);
    } catch (error) {
      const answer = foreseen(error);
      if (answer !== null) return answer;
      log.error('{tool} failed unexpectedly: {error}', {
        tool,
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return failure(
        `${tool} failed: ${message(error)}`,
        'This was not a foreseen failure. The server logged it under .noesis/logs/; retrying the same call is unlikely to help.',
      );
    }
  };
}

function foreseen(error: unknown): CallToolResult | null {
  if (error instanceof WorkingFileError) return failure(error.message);
  if (error instanceof BackendError) return failure(error.message);
  if (error instanceof NotFoundError) {
    return failure(error.message, FIND_OR_ADD[error.entity]);
  }
  if (error instanceof ConcurrentModificationError) {
    return failure(
      `${error.message} Nothing was written.`,
      `Another call wrote to the change while this one ran. Read it again with ${LIST_CHANGES}, then repeat this call with what you still mean to write.`,
    );
  }
  if (error instanceof InvalidDesignDocError) {
    return failure(
      'Invalid design document; fix each field and call again:',
      error.violations
        .map(({ path, reason }) => `- ${path}: ${FIXES[reason]}`)
        .join('\n'),
    );
  }
  return null;
}

const FIND_OR_ADD: Record<Entity, string> = {
  change: `Find the change's id with ${LIST_CHANGES}, or create it with ${CREATE_CHANGE}.`,
  'source document': `Find its id with ${LIST_CHANGES}, or add the source document with ${ADD_SOURCE_DOCUMENT_TO_CHANGE}.`,
  'design document': `Find its id with ${LIST_CHANGES}, or add the design document with ${ADD_DESIGN_DOC_TO_CHANGE}.`,
};

const FIXES: Record<DesignDocViolation['reason'], string> = {
  changedInGreenField:
    'nothing is scanned yet, so a design only adds; add this instead',
  unknownElement:
    'the scanned model has no such element or part; add it instead of modifying or removing it',
  unchangedFieldInAddedItem:
    'the item is new, so this field needs a { "value" }',
  humanAuthor: 'write every field as the agent: leave "author" out',
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
