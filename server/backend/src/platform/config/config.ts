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
  /** `1` serves the session in one process, MCP and ui together, taking no lock. */
  NOESIS_NO_DAEMON: z.string().optional(),
  NOESIS_GRACE_MS: milliseconds(5 * 60 * 1000),
  NOESIS_PPID_POLL_MS: milliseconds(5 * 1000),
  NOESIS_STARTUP_TIMEOUT_MS: milliseconds(15 * 60 * 1000),
});

function milliseconds(fallback: number) {
  return z.coerce.number().int().min(0).default(fallback);
}

export interface ServerConfig {
  /** Unset: found by walking up from cwd to `.git`. */
  root: string | undefined;
  openBrowser: boolean;
  port: number;
  logLevel: LogLevel;
  /** Serve the session in-process instead of through the repository's daemon. */
  noDaemon: boolean;
  /** How long a managed daemon waits with no session attached before it exits. */
  graceMs: number;
  /** How often a session checks that its host still runs; `0` never. */
  ppidPollMs: number;
  /** How long a session waits for its host's first byte; `0` forever. */
  startupTimeoutMs: number;
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
    noDaemon: parsed.data.NOESIS_NO_DAEMON === '1',
    graceMs: parsed.data.NOESIS_GRACE_MS,
    ppidPollMs: parsed.data.NOESIS_PPID_POLL_MS,
    startupTimeoutMs: parsed.data.NOESIS_STARTUP_TIMEOUT_MS,
  };
}
