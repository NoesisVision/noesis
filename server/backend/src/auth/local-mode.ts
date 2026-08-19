import { randomBytes } from 'node:crypto';
import type { GithubAuthConfig } from '../config/config.js';
import {
  createFakeGithub,
  type FakeAccount,
  type FakeGithub,
  type FakeRepository,
  testPrivateKey,
} from './github-fake.js';

/**
 * `NOESIS_AUTH_MODE=local`: the whole GitHub side of the App, in memory.
 *
 * The point is that nothing else changes. The module built from this is an
 * ordinary `mode: 'github'` module, so sign-in, admission, invites, the repo
 * picker and the access check all run their real code — only the outbound
 * `fetch` is ours. A contributor gets every flow without registering an App,
 * and the flows they exercise are the ones production runs.
 */

/** The identities `/auth/login?as=<login>` can sign in as. */
export const LOCAL_ACCOUNTS: FakeAccount[] = [
  {
    profile: {
      id: 1001,
      login: 'octocat',
      name: 'Octo Cat',
      // Left empty on purpose: the avatar falls back to initials, so local
      // development makes no network request for an image.
      avatar_url: '',
      email: 'octocat@local.test',
    },
    installations: [
      {
        id: 1,
        account: { login: 'octocat', type: 'User' },
        repository_selection: 'selected',
      },
      {
        id: 2,
        account: { login: 'acme', type: 'Organization' },
        repository_selection: 'all',
      },
    ],
  },
  {
    profile: {
      id: 1002,
      login: 'alice',
      name: 'Alice Vega',
      avatar_url: '',
      email: 'alice@local.test',
    },
    // Only the org installation: signing in as alice and as octocat must not
    // show the same picker, or the per-account paths never get exercised.
    installations: [
      {
        id: 2,
        account: { login: 'acme', type: 'Organization' },
        repository_selection: 'all',
      },
    ],
  },
  {
    profile: {
      id: 1003,
      login: 'bob',
      name: 'Bob Marsh',
      avatar_url: '',
      email: 'bob@local.test',
    },
    installations: [
      {
        id: 2,
        account: { login: 'acme', type: 'Organization' },
        repository_selection: 'all',
      },
    ],
  },
];

/** Keyed by installation id — installations are shared, accounts are not. */
const LOCAL_REPOSITORIES: Record<number, FakeRepository[]> = {
  1: [
    { id: 9001, full_name: 'octocat/scratchpad', private: false },
    { id: 9002, full_name: 'octocat/dotfiles', private: true },
  ],
  2: [
    { id: 9101, full_name: 'acme/storefront', private: false },
    { id: 9102, full_name: 'acme/billing', private: true },
    { id: 9103, full_name: 'acme/platform-docs', private: false },
    { id: 9104, full_name: 'acme/legacy-monolith', private: true },
  ],
};

export function createLocalGithub(): FakeGithub {
  return createFakeGithub({
    accounts: LOCAL_ACCOUNTS,
    repositories: LOCAL_REPOSITORIES,
  });
}

/**
 * App coordinates that are never sent anywhere real. The private key has to be
 * a genuine RSA key — `@octokit/auth-app` signs an App JWT with it before the
 * fake ever sees the request — and the token key is fresh each boot, which is
 * exactly right: local credentials must not survive a restart.
 */
export function localGithubConfig(publicUrl: string): GithubAuthConfig {
  return {
    mode: 'github',
    publicUrl,
    appId: '1',
    appSlug: 'noesis-local',
    clientId: 'Iv1.local',
    clientSecret: 'local-client-secret',
    privateKey: testPrivateKey(),
    tokenKey: randomBytes(32),
  };
}
