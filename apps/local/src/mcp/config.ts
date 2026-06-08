import { z } from 'zod';

const envSchema = z.object({
  /** Base URL of the server app this MCP server talks to over REST. */
  serverUrl: z.url().default('http://localhost:3000'),
});

export type McpConfig = z.infer<typeof envSchema>;

/** Parses MCP config from the environment; throws with a clear message on bad values. */
export function loadConfig(): McpConfig {
  const parsed = envSchema.safeParse({
    serverUrl: process.env.NOESIS_SERVER_URL || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid MCP configuration: NOESIS_SERVER_URL — ${parsed.error.issues
        .map((i) => i.message)
        .join('; ')}`,
    );
  }
  return parsed.data;
}
