import { z } from 'zod';

// Server configuration is read from the environment and zod-validated at
// bootstrap, failing fast on garbage (decision 10's pattern). The service
// serves the one repository `NOESIS_ROOT` names — or, when unset, the checkout
// it was started in (the walk to `.git` lives in `files/repository-root.ts`).
//
// There is little else to configure: the service runs locally inside a single
// checkout, one process per agent session, so it has no identity provider, no
// tenant scoping and no public URL (decision 65), and its graph is an
// in-memory cache with no data directory (decision 68). The HTTP port is
// ephemeral; `PORT` pins it only for the Vite dev proxy (`bun run dev`), and
// is not part of the plugin's launch — two agent sessions must not collide.
const envSchema = z.object({
  NOESIS_ROOT: z.string().min(1).optional(),
  /** `0` keeps the browser closed — headless runs and tests. */
  NOESIS_OPEN_BROWSER: z.string().optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(0),
});

export interface ServerConfig {
  /** The repository root, when set explicitly; otherwise found from cwd. */
  root: string | undefined;
  openBrowser: boolean;
  /** `0` for an ephemeral port. */
  port: number;
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
  return {
    ok: true,
    config: {
      root: parsed.data.NOESIS_ROOT,
      openBrowser: parsed.data.NOESIS_OPEN_BROWSER !== '0',
      port: parsed.data.PORT,
    },
  };
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
