// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';

// Placeholder contract — replace with real MCP tool payloads as they appear.
export const helloRequestSchema = z
  .object({
    name: z.string().min(1).describe('Name of the person to greet'),
  })
  .describe('Payload for the `hello` MCP tool');

export type HelloRequest = z.infer<typeof helloRequestSchema>;

export const helloRequestExample: HelloRequest = {
  name: 'Ada',
};
