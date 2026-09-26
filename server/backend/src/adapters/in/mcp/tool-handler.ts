import type {
  CallToolResult,
  ServerContext,
} from '@modelcontextprotocol/server';
import { serverLogger } from '#backend/platform/logging/logging';
import { failure } from './tool-result';

const log = serverLogger('mcp');

/**
 * The last resort around a tool. What a tool foresees it answers itself;
 * what it does not, the SDK would turn into an in-band error
 * silently, leaving nothing in `.noesis/logs/` for the person whose session
 * just failed. Every handler is registered through here, so the server keeps
 * the record and the agent still gets an answer it can read.
 */
export function logged<Input>(
  tool: string,
  handler: (input: Input, ctx: ServerContext) => Promise<CallToolResult>,
): (input: Input, ctx: ServerContext) => Promise<CallToolResult> {
  return async (input, ctx) => {
    try {
      return await handler(input, ctx);
    } catch (error) {
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
