import type {
  CallToolResult,
  ServerContext,
} from '@modelcontextprotocol/server';
import type { DesignDocViolation } from '#backend/app/design-docs/design-doc';
import { InvalidDesignDocError } from '#backend/app/design-docs/invalid-design-doc-error';
import { type Entity, NotFoundError } from '#backend/app/not-found-error';
import { serverLogger } from '#backend/platform/logging/logging';
import {
  CREATE_CHANGE,
  CREATE_DESIGN_DOC_IN_CHANGE,
  CREATE_DOCUMENT_IN_CHANGE,
  LIST_CHANGES,
  LIST_DOCUMENTS_IN_CHANGE,
} from './tool-names';
import { failure } from './tool-result';

const log = serverLogger('mcp');

/**
 * The last resort around a tool. What the handlers throw for a caller's
 * mistake — a missing entity, a design that breaks its rules — is answered
 * here, once, with what to do next. Anything else the SDK would turn into an
 * in-band error silently, leaving nothing in `.noesis/logs/` for the person
 * whose session just failed; every tool is registered through here, so the
 * server keeps the record and the agent still gets an answer it can read.
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
  if (error instanceof NotFoundError) {
    return failure(error.message, FIND_OR_CREATE[error.entity]);
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

const FIND_OR_CREATE: Record<Entity, string> = {
  change: `Find the change's id with ${LIST_CHANGES}, or create it with ${CREATE_CHANGE}.`,
  document: `Find the document's id with ${LIST_DOCUMENTS_IN_CHANGE}, or create the document with ${CREATE_DOCUMENT_IN_CHANGE}.`,
  'design document': `Pass the id ${CREATE_DESIGN_DOC_IN_CHANGE} answered with, or create the design document with it.`,
};

const FIXES: Record<DesignDocViolation['reason'], string> = {
  changedInGreenField:
    'nothing is scanned yet, so a design only adds; add this instead',
  unknownElement:
    'the scanned model has no such element or part; add it instead of modifying or removing it',
  unchangedFieldInAddedItem:
    'the item is new, so this field needs a { "value" }',
  humanAuthor: 'write every field as the agent: leave "author" out',
  diagramInDescription:
    'move the ```mermaid fence out of the description: write its source, without the fence, to the element\'s "diagram"',
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
