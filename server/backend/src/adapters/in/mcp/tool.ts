import type {
  CallToolResult,
  McpServer,
  ToolAnnotations,
  ToolCallback,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { logged } from './tool-handler';

/** Hands one tool to a server; the server registers each in turn. */
export type ToolRegistration = (server: McpServer) => void;

interface ToolConfig<Input extends z.ZodObject> {
  title: string;
  description: string;
  inputSchema: Input;
  outputSchema: z.ZodObject;
  annotations: ToolAnnotations;
}

/**
 * Every tool is defined through here, so none can be registered without
 * `logged` around its handler.
 */
export function defineTool<Input extends z.ZodObject>(
  name: string,
  config: ToolConfig<Input>,
  handler: (input: z.output<Input>) => Promise<CallToolResult>,
): ToolRegistration {
  // The SDK types the callback as a conditional on `Input`, which TypeScript
  // cannot resolve while `Input` is still generic; for an object schema it is
  // exactly `(input: z.output<Input>, ctx) => ...`.
  const callback = logged(name, handler) as ToolCallback<Input>;
  return (server) => {
    server.registerTool(name, config, callback);
  };
}

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Adds a new entity at an id the server mints: calling twice adds two. */
export const CREATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/**
 * Replaces an existing entity whole: calling twice with the same file stores
 * the same thing, and what the file leaves out is gone.
 */
export const UPDATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};
