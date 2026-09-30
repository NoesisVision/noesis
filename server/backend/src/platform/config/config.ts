import type { LogLevel } from '@logtape/logtape';
import { z } from 'zod';
import {
  DEFAULT_LOG_LEVEL,
  parseLogLevel,
} from '#backend/platform/logging/logging';

/** The source code scanners a system model can be built with. */
export const ScannerName = z.enum(['java', 'csharp', 'dummy']);
export type ScannerName = z.infer<typeof ScannerName>;

// `PORT` pins the otherwise ephemeral port only for a stable URL under
// `bun run dev`; the plugin's launch never sets it, so two agent sessions
// cannot collide.
const envSchema = z.object({
  NOESIS_ROOT: z.string().min(1).optional(),
  /** `0` keeps the browser closed — headless runs and tests. */
  NOESIS_OPEN_BROWSER: z.string().optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(0),
  NOESIS_LOG_LEVEL: z.string().optional(),
  NOESIS_SCANNER: ScannerName.default('dummy'),
});

export interface ServerConfig {
  /** Unset: found by walking up from cwd to `.git`. */
  root: string | undefined;
  openBrowser: boolean;
  port: number;
  logLevel: LogLevel;
  /** Which scanner builds the system model. */
  scanner: ScannerName;
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
