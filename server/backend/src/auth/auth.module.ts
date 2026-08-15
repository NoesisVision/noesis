import type { AuthConfig, GithubAuthConfig } from '../config/config.js';
import type { DatabaseService } from '../database/database.service.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { GhAppService } from './gh-app.service.js';
import { GhTokenService } from './gh-token.service.js';
import { type FetchLike, GithubService } from './github.service.js';
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
}

export interface DisabledAuthModule {
  mode: 'disabled';
}

export type AuthModule = GithubAuthModule | DisabledAuthModule;

export function createAuthModule(
  config: AuthConfig,
  db: DatabaseService,
  fetchImpl?: FetchLike,
): AuthModule {
  if (config.mode === 'disabled') return { mode: 'disabled' };

  const repo = new AuthRepository(db);
  const sessions = new SessionService(repo);
  const github = new GithubService(config, fetchImpl);
  return {
    mode: 'github',
    config,
    repo,
    sessions,
    github,
    auth: new AuthService(repo, sessions, github, config.tokenKey),
    ghTokens: new GhTokenService(repo, github, config.tokenKey),
    ghApp: new GhAppService(config, fetchImpl),
    secureCookies: new URL(config.publicUrl).protocol === 'https:',
    // The client secret is already the App's shared secret with GitHub and is
    // never sent to a browser, so it doubles as the state cookie's signing key
    // rather than adding an eighth variable to configure.
    stateSecret: config.clientSecret,
  };
}
