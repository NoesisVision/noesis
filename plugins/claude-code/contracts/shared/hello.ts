// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';

export const helloResponseSchema = z
  .object({
    message: z.string().describe('Greeting returned by the server'),
  })
  .describe('Response of the server `hello` endpoint');

export type HelloResponseDto = z.infer<typeof helloResponseSchema>;
