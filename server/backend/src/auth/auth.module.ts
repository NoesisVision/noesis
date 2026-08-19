import type { AuthConfig, GithubAuthConfig } from '../config/config.js';
import type { DatabaseService } from '../database/database.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { GhAppService } from './gh-app.service.js';
import { GhTokenService } from './gh-token.service.js';
import { type FetchLike, GithubService } from './github.service.js';
import type { FakeGithub } from './github-fake.js';
import { createLocalGithub, localGithubConfig } from './local-mode.js';
import { SessionService } from './session.service.js';

/**
 * The assembled auth slice, in the shape the surfaces consume it. It is a
 * discriminated union rather than a bag of nullables so a handler cannot reach
 * for `github` without having established the mode first.
 */
export interface GithubAuthModule {
  mode: 'github';
  config: GithubAuthConfig;
  repo: AuthRepository;
  sessions: SessionService;
  auth: AuthService;
  github: GithubService;
  ghTokens: GhTokenService;
  /** The App's own identity; no consumer yet — see GhAppService. */
  ghApp: GhAppService;
  /** `Secure` cookies everywhere except a plain-http localhost origin. */
  secureCookies: boolean;
  /** Signs the short-lived OAuth `state` cookie. */
  stateSecret: string;
  /**
   * Set only under `NOESIS_AUTH_MODE=local`. Its presence is what tells the
   * `/auth` routes there is no github.com to bounce the browser off, and it
   * names the identities that may sign in. Everything else treats this module
   * as the ordinary github one, which is the whole point.
   */
  fake?: FakeGithub;
}

export interface DisabledAuthModule {
  mode: 'disabled';
}

export type AuthModule = GithubAuthModule | DisabledAuthModule;

/**
 * The mode as *configured*, which is the one thing `local` cannot infer from
 * the module's shape — it is deliberately a github module everywhere else.
 * Only the two reports that a client reads it from need this.
 */
export function authModeName(
  module: AuthModule,
): 'github' | 'local' | 'disabled' {
  if (module.mode === 'disabled') return 'disabled';
  return module.fake === undefined ? 'github' : 'local';
}

export function createAuthModule(
  config: AuthConfig,
  db: DatabaseService,
  fetchImpl?: FetchLike,
): AuthModule {
  if (config.mode === 'disabled') return { mode: 'disabled' };

  // Local mode is the github mode with a synthesized App and an in-memory
  // GitHub behind it — assembled here rather than branching downstream, so no
  // route has to know which of the two it is serving.
  const fake = config.mode === 'local' ? createLocalGithub() : undefined;
  const appConfig =
    config.mode === 'local' ? localGithubConfig(config.publicUrl) : config;

  const repo = new AuthRepository(db);
  const sessions = new SessionService(repo);
  const github = new GithubService(appConfig, fake?.fetch ?? fetchImpl);
  return {
    mode: 'github',
    config: appConfig,
    fake,
    repo,
    sessions,
    github,
    auth: new AuthService(repo, sessions, github, appConfig.tokenKey),
    ghTokens: new GhTokenService(repo, github, appConfig.tokenKey),
    ghApp: new GhAppService(appConfig, fake?.fetch ?? fetchImpl),
    secureCookies: new URL(appConfig.publicUrl).protocol === 'https:',
    // The client secret is already the App's shared secret with GitHub and is
    // never sent to a browser, so it doubles as the state cookie's signing key
    // rather than adding an eighth variable to configure.
    stateSecret: appConfig.clientSecret,
  };
}
