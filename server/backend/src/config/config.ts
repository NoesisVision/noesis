import { z } from 'zod';

// Server configuration is read from the environment and zod-validated at
// bootstrap, failing fast on garbage (decision 10's pattern). The server keeps
// exactly ONE data dir for its on-disk DB; projects are scoped inside the DB by
// `project_id` (OQ-2.2), not by per-project directories — so the SDLC
// `PROJECT_DIR` is gone.
//
// Identity is a GitHub App (decision 46): every deployment registers its own,
// so the App's coordinates are configuration rather than a shipped constant.
// The whole GitHub block is conditionally required — `NOESIS_AUTH_MODE=disabled`
// lets a contributor run `dev:server` and the suites without registering an
// App — and the production refusal below keeps that escape hatch from becoming
// a footgun.
const envSchema = z.object({
  NOESIS_DATA_DIR: z.string().min(1).default('.data'),
  NOESIS_AUTH_MODE: z.enum(['github', 'disabled']).default('github'),
  NOESIS_PUBLIC_URL: z.url().optional(),
  NOESIS_GITHUB_APP_ID: z.string().min(1).optional(),
  NOESIS_GITHUB_APP_SLUG: z.string().min(1).optional(),
  NOESIS_GITHUB_CLIENT_ID: z.string().min(1).optional(),
  NOESIS_GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  NOESIS_GITHUB_PRIVATE_KEY: z.string().min(1).optional(),
  NOESIS_TOKEN_KEY: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

export interface GithubAuthConfig {
  mode: 'github';
  /** Origin the OAuth `redirect_uri` is built from; must match the App's registered callback. */
  publicUrl: string;
  appId: string;
  /** Builds the install URL `https://github.com/apps/<slug>/installations/new`. */
  appSlug: string;
  clientId: string;
  clientSecret: string;
  /** Decoded PEM — the env var carries it base64-encoded so it survives one-line env vars. */
  privateKey: string;
  /** 32 raw bytes; AES-256-GCM key for GitHub tokens at rest. */
  tokenKey: Buffer;
}

export interface DisabledAuthConfig {
  mode: 'disabled';
}

export type AuthConfig = GithubAuthConfig | DisabledAuthConfig;

export interface ServerConfig {
  dataDir: string;
  auth: AuthConfig;
}

export type ConfigResult =
  | { ok: true; config: ServerConfig }
  | { ok: false; message: string };

/** The GitHub block, all-or-nothing when `NOESIS_AUTH_MODE=github`. */
const GITHUB_VARS = [
  'NOESIS_PUBLIC_URL',
  'NOESIS_GITHUB_APP_ID',
  'NOESIS_GITHUB_APP_SLUG',
  'NOESIS_GITHUB_CLIENT_ID',
  'NOESIS_GITHUB_CLIENT_SECRET',
  'NOESIS_GITHUB_PRIVATE_KEY',
  'NOESIS_TOKEN_KEY',
] as const satisfies readonly (keyof Env)[];

// Pure and total, so the config rules are unit-testable without a process exit.
export function parseServerConfig(env: NodeJS.ProcessEnv): ConfigResult {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
    };
  }
  const data = parsed.data;
  const dataDir = data.NOESIS_DATA_DIR;

  if (data.NOESIS_AUTH_MODE === 'disabled') {
    if (data.NODE_ENV === 'production') {
      return {
        ok: false,
        message:
          'NOESIS_AUTH_MODE=disabled refuses to start with NODE_ENV=production. ' +
          'It exists for local development and tests only.',
      };
    }
    return { ok: true, config: { dataDir, auth: { mode: 'disabled' } } };
  }

  const missing = GITHUB_VARS.filter((name) => data[name] === undefined);
  if (missing.length > 0) {
    return {
      ok: false,
      message:
        `NOESIS_AUTH_MODE=github requires: ${missing.join(', ')}. ` +
        'Register a GitHub App for this deployment, or set NOESIS_AUTH_MODE=disabled outside production.',
    };
  }

  const tokenKey = decodeTokenKey(data.NOESIS_TOKEN_KEY as string);
  if (tokenKey === null) {
    return {
      ok: false,
      message:
        'NOESIS_TOKEN_KEY must be exactly 32 bytes, base64-encoded. ' +
        'Generate one with: bun -e "console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())"',
    };
  }

  const privateKey = decodePrivateKey(data.NOESIS_GITHUB_PRIVATE_KEY as string);
  if (privateKey === null) {
    return {
      ok: false,
      message:
        'NOESIS_GITHUB_PRIVATE_KEY must be the App private key PEM, base64-encoded.',
    };
  }

  return {
    ok: true,
    config: {
      dataDir,
      auth: {
        mode: 'github',
        // Trailing slashes would produce `//auth/callback` in the redirect_uri,
        // which GitHub compares against the registered callback verbatim.
        publicUrl: (data.NOESIS_PUBLIC_URL as string).replace(/\/+$/, ''),
        appId: data.NOESIS_GITHUB_APP_ID as string,
        appSlug: data.NOESIS_GITHUB_APP_SLUG as string,
        clientId: data.NOESIS_GITHUB_CLIENT_ID as string,
        clientSecret: data.NOESIS_GITHUB_CLIENT_SECRET as string,
        privateKey,
        tokenKey,
      },
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

function decodeTokenKey(base64: string): Buffer | null {
  const key = Buffer.from(base64, 'base64');
  return key.length === 32 ? key : null;
}

// Accepts the PEM either base64-encoded (the documented form, survives a
// one-line env var) or pasted verbatim with real newlines.
function decodePrivateKey(value: string): string | null {
  const pem = value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
  return pem.includes('-----BEGIN') && pem.includes('PRIVATE KEY') ? pem : null;
}
