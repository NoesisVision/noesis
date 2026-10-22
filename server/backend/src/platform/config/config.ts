import type { LogLevel } from '@logtape/logtape';
import { z } from 'zod';
import {
  DEFAULT_LOG_LEVEL,
  parseLogLevel,
} from '#backend/platform/logging/logging';

/**
 * The one scanner the environment may force: `dummy` replays the implemented
 * design documents instead of reading code. Which code scanner reads a
 * repository is the repository's own `.noesis/settings.json`.
 */
export const ScannerOverride = z.literal('dummy');
export type ScannerOverride = z.infer<typeof ScannerOverride>;

// `PORT` pins the otherwise ephemeral port only for a stable URL under
// `bun run dev`; the plugin's launch never sets it, so two agent sessions
// cannot collide.
const envSchema = z.object({
  NOESIS_ROOT: z.string().min(1).optional(),
  /** `0` keeps the browser closed — headless runs and tests. */
  NOESIS_OPEN_BROWSER: z.string().optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(0),
  NOESIS_LOG_LEVEL: z.string().optional(),
  NOESIS_SCANNER: ScannerOverride.optional(),
});

export interface ServerConfig {
  /** Unset: found by walking up from cwd to `.git`. */
  root: string | undefined;
  openBrowser: boolean;
  port: number;
  logLevel: LogLevel;
  /** `dummy` to replay design documents; unset scans by the repository's configuration. */
  scanner: ScannerOverride | undefined;
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
      logLevel:
        parsed.data.NOESIS_LOG_LEVEL === undefined
          ? DEFAULT_LOG_LEVEL
          : parseLogLevel(parsed.data.NOESIS_LOG_LEVEL),
      scanner: parsed.data.NOESIS_SCANNER,
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
