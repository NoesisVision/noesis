import { getLogLevels, type LogLevel } from '@logtape/logtape';
import { z } from 'zod';
import { DEFAULT_LOG_LEVEL } from '#backend/platform/logging/logging';
import { ConfigurationError } from './configuration-error';

// `PORT` pins the otherwise ephemeral port only for a stable URL under
// `bun run dev`; the plugin's launch never sets it, so two agent sessions
// cannot collide.
const envSchema = z.object({
  NOESIS_ROOT: z.string().min(1).optional(),
  /** `0` keeps the browser closed — headless runs and tests. */
  NOESIS_OPEN_BROWSER: z.string().optional(),
  PORT: z.coerce.number().int().min(0).max(65535).default(0),
  NOESIS_LOG_LEVEL: z.enum(getLogLevels()).default(DEFAULT_LOG_LEVEL),
});

export interface ServerConfig {
  /** Unset: found by walking up from cwd to `.git`. */
  root: string | undefined;
  openBrowser: boolean;
  port: number;
  logLevel: LogLevel;
}

/** Throws `ConfigurationError` for an environment the server cannot start on. */
export function loadServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigurationError(
      `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return {
    root: parsed.data.NOESIS_ROOT,
    openBrowser: parsed.data.NOESIS_OPEN_BROWSER !== '0',
    port: parsed.data.PORT,
    logLevel: parsed.data.NOESIS_LOG_LEVEL,
  };
}
