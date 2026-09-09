import { z } from 'zod';

// Server configuration is read from the environment and zod-validated at
// bootstrap, failing fast on garbage (decision 10's pattern). The server keeps
// exactly ONE data dir for its on-disk DB.
//
// There is nothing else to configure: the server runs locally inside a single
// checkout as part of the Claude plugin, so it has no identity provider, no
// tenant scoping and no public URL (decision 65).
const envSchema = z.object({
  NOESIS_DATA_DIR: z.string().min(1).default('.data'),
});

export interface ServerConfig {
  dataDir: string;
}

export type ConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; message: string };

// Pure and total, so the config rules are unit-testable without a process exit.
export function parseServerConfig(env: NodeJS.ProcessEnv): ConfigResult {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
    };
  }
  return { ok: true, config: { dataDir: parsed.data.NOESIS_DATA_DIR } };
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const result = parseServerConfig(env);
  if (!result.ok) {
    console.error(`[config] ${result.message}`);
    process.exit(1);
  }
  return result.config;
}
