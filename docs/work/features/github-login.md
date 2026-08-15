# Feature Plan: Login with GitHub

**Status:** built (2026-08-13) — architecture recorded as decision 46 in
[`docs/decisions.md`](../../decisions.md), whose consequences list what the
implementation changed. Steps 1–8 of §9 are done; §10 is still out of scope.
**Goal:** Give Noesis a sign-in flow backed by GitHub, and — in the same
mechanism — the credentials it needs to read users' repositories. GitHub is
both the identity provider and the resource server, so the two concerns are
served by one integration rather than bolted together later.

## 1. Why a GitHub App and not an OAuth App

The system's reason for touching GitHub is repository access, not just a name
and an avatar. That single fact decides the primitive:

|                                | OAuth App                                     | GitHub App                                         |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| Repository scoping             | all-or-nothing `repo` scope                   | user picks repositories at install time            |
| Permissions                    | coarse scopes                                 | fine-grained, per-resource                         |
| User token lifetime            | never expires until revoked                   | 8 h access token + 6 month refresh token           |
| Background access              | none — only the user's token                  | 1 h installation tokens, no user present           |
| Org posture                    | admin must whitelist third-party OAuth access | org admin approves an install, with an audit trail |
| Survives the installer leaving | no                                            | yes — the app is its own identity                  |
| Rate limit                     | the user's                                    | scales with installation size                      |

GitHub's own guidance is that GitHub Apps are the preferred integration, and
every axis above points the same way for this system. An OAuth App would be
about a day of work, but converting to a GitHub App afterwards is a breaking
re-authentication for every user, so the cheap start is not actually cheap.

Two GitHub authentication paths fall out of one App, and Noesis needs both:

- **user-to-server** — the web sign-in flow. Produces a token that acts _as the
  signed-in user_, limited by both the App's permissions and the user's own
  access. This is what the login button drives.
- **server-to-server (installation)** — a token minted from the App's private
  key for a given installation. Acts as the App itself, no user present. This
  is what background scanning and webhook handling will use.

## 2. Why hand-rolled with Octokit rather than an auth library

Arctic — the usual "OAuth clients only, bring your own session" choice — was
deprecated in July 2026, so the maintained low-level option is Octokit, which
this system needs anyway to call the GitHub API.

The alternative considered was Better Auth. It is the better-supported library
and would hand over sessions, CSRF, account linking and an API-key plugin for
free, but it wants a relational store, and Noesis keeps exactly one datastore:
the LadybugDB graph. That leaves two bad shapes — a second `bun:sqlite` file
next to the graph (contradicting the single-data-dir rule the config module is
explicit about), or a custom Cypher adapter implementing Better Auth's
relational adapter contract and re-verified on every minor release. Better
Auth's GitHub provider also has a known gap around storing `refresh_token` /
`refresh_token_expires_in`, which matters precisely because GitHub App user
tokens expire after 8 hours.

Against that, the hand-rolled cost is bounded: the OAuth mechanics are a code
exchange and a refresh call (both shipped as functions by
`@octokit/oauth-methods`), and the session is an opaque cookie plus one node
table. The route surfaces that middleware binds to already exist — decision 18
split `/ui`, `/api` and `/internal` by consumer for exactly this reason, and
decision 45 anticipated a chrome-less route next to `_shell` for exactly this
kind of page.

Revisit Better Auth if the auth surface grows beyond sign-in — organisations,
2FA, user-managed API keys.

## 3. Dependencies

Backend, all in the `@octokit` scope:

- `@octokit/oauth-methods` — `getWebFlowAuthorizationUrl`, `exchangeWebFlowCode`,
  `refreshToken`, `deleteAuthorization`. Request-level functions, no framework
  assumptions, no ambient state. (`@octokit/oauth-app` wraps these in a class
  with its own Octokit instance and Node-http middleware; the class buys
  nothing here and the middleware does not fit Hono on Bun.)
- `@octokit/auth-app` — App JWT + installation token minting and caching.
- `octokit` — the API client used to read `/user`, `/user/installations` and,
  later, repository contents.

No frontend dependency: sign-in is a plain link to a backend redirect endpoint.

## 4. Configuration

New `NOESIS_*` variables, zod-validated in `config.ts` and fail-fast at boot,
matching the existing pattern:

| Variable                      | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `NOESIS_PUBLIC_URL`           | Origin used to build the OAuth `redirect_uri`; must match the App's registered callback  |
| `NOESIS_GITHUB_APP_ID`        | Numeric App id (installation tokens)                                                     |
| `NOESIS_GITHUB_APP_SLUG`      | Used to build the install URL `https://github.com/apps/<slug>/installations/new`         |
| `NOESIS_GITHUB_CLIENT_ID`     | User web flow                                                                            |
| `NOESIS_GITHUB_CLIENT_SECRET` | User web flow                                                                            |
| `NOESIS_GITHUB_PRIVATE_KEY`   | PEM, for the App JWT; base64-encoded so it survives one-line env vars                    |
| `NOESIS_TOKEN_KEY`            | base64 32-byte AES-256-GCM key encrypting GitHub tokens at rest                          |
| `NOESIS_AUTH_MODE`            | `github` (default) or `disabled`; `disabled` refuses to start when `NODE_ENV=production` |

`NOESIS_AUTH_MODE=disabled` exists so contributors can run `bun run dev:server`
and the test suites without registering a GitHub App. It short-circuits the
guard to a fixed local owner account and is the only reason the whole config
block is conditionally required; the production refusal keeps it from becoming
a footgun.

## 5. Graph schema

Appended to `graph-schema.ts` under a new heading, idempotent like everything
already there.

```
Account(id, gh_user_id, login, name, avatar_url, email, role,
        version, created_at, PK id)                        -- role: 'owner' | 'member'
Session(id, created_at, expires_at, PK id)            -- id = SHA-256 of the cookie token
GhCredential(id, access_token_enc, access_expires_at,
             refresh_token_enc, refresh_expires_at,
             version, created_at, PK id)
GhInstallation(id, account_login, account_type,
               repository_selection, created_at, PK id)   -- id = GitHub installation_id
Invite(id, gh_login, invited_by, created_at, accepted_at, PK id)
```

Relationships: `HasSession(Account → Session)`,
`HasCredential(Account → GhCredential)`,
`HasInstallation(Account → GhInstallation)`.

`User` is avoided as a table name to keep room for a future domain notion of a
person distinct from a login identity; `Account` names what this actually is.

Tokens live on their own node rather than as `Account` properties so no query
that reads a user can accidentally select a credential, and so rotation touches
one row.

`role` is a string rather than an `is_owner` boolean so a third role can appear
without a migration.

### What a Project binds to (shape settled here, built with project CRUD)

A project binds to **exactly one** installation, and tracks a subset of that
installation's repositories:

```
Project ──UsesInstallation──▶ GhInstallation      (exactly one)
   └─────Tracks─────▶ Repository ──InInstallation──▶ GhInstallation
```

Cross-organisation projects are explicitly not supported: a system spanning two
orgs needs two Noesis projects. This is what makes the repository picker a flat
list rather than a grouped one, and what lets every repository-scoped query
resolve to a single installation token.

The `Project` relationships and the `Repository` table are **not part of this
change** — project creation does not exist yet (the shell's project switcher
runs on placeholder state, per decision 45). They are written down here because
the cardinality decides how `GhInstallation` is modelled now: hanging off
`Account` alone, reachable later from `Project` by a second relationship rather
than by an owning one.

Note that repository selection happens on **two screens with different
authority**. GitHub's install screen decides what the App may touch at all —
chosen by an org admin, invisible to Noesis. The Noesis project screen then
picks from that list. A repository the admin never granted cannot be offered
and cannot be requested through the API; the best the UI can do is deep-link to
`https://github.com/organizations/<org>/settings/installations/<id>`.

## 6. Backend surface

A fourth top-level surface, `/auth`, mounted in `app.ts` next to `/ui`, `/api`
and `/internal`, and added to `main.ts`'s SPA-fallback exclusion list. It is a
surface by decision 18's own criterion — its consumer is the browser's address
bar, exchanging 302s and cookies, not the typed JSON RPC contract `/ui` owes
`hc<AppType>`. Keeping it out of `/ui` also avoids the ordering problem of
mounting unguarded routes inside a guarded sub-app.

| Route                        | Behaviour                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/login`            | Generates `state`, sets it in a short-lived signed cookie, 302 to GitHub's authorize URL                                          |
| `GET /auth/callback`         | Verifies `state`, exchanges the code, applies the admission rule, upserts `Account` + `GhCredential`, opens a session, 302 to `/` |
| `POST /auth/logout`          | Deletes the session row, clears the cookie                                                                                        |
| `GET /auth/install`          | 302 to the App's installation page with a `state`                                                                                 |
| `GET /auth/install/callback` | Records `installation_id` from GitHub's `setup_action` redirect, links it to the account                                          |

On `/ui`, a `requireSession` middleware and these endpoints:

- `GET /ui/me` →
  `{ account: { login, name, avatarUrl, role }, installations: [...] }`, or
  `401`. The SPA's guard reads this; its response type reaches the frontend
  through `AppType` like every other `/ui` route, so no contracts package.
- `GET /ui/invites`, `POST /ui/invites` (`{ ghLogin }`),
  `DELETE /ui/invites/:id` — behind a `requireOwner` middleware layered on
  `requireSession`.

`/api` (the MCP bridge) is explicitly **out of scope** — see §10.

### Admission: who may sign in

GitHub authenticates identity; it says nothing about whether this deployment
wants that person. Without a rule, any GitHub account that reaches
`/auth/login` on a public Railway URL gets an `Account` row.

The rule, applied in `/auth/callback` after the code exchange and before any
write:

1. An `Account` already exists for this `gh_user_id` → sign in.
2. No `Account` exists **at all** → this login claims the instance;
   `role = 'owner'`.
3. An unaccepted `Invite` matches the GitHub login → create the account with
   `role = 'member'`, stamp `accepted_at`.
4. Otherwise → no account is created, no session is opened, 302 back to
   `/login?error=not_invited`.

Steps 2 and 4 are the whole gate: a fresh deployment is claimed by whoever
reaches it first, and everyone after that needs an owner to invite them by
GitHub login. It needs no configuration, which is the point — a config-based
allowlist is one forgotten redeploy away from either locking the owner out or
letting the internet in.

The race in step 2 (two first-logins at once) is closed by making the ownership
claim a conditional write guarded by the account count, not a read-then-write.

Invites are by GitHub login, not email: the login is what the callback can
verify, and an email from `/user` may be private or unverified.

### Session mechanics

- Cookie `noesis_session`: 32 random bytes, base64url. `HttpOnly`, `Secure`
  (except on `http://localhost`), `SameSite=Lax`, `Path=/`, 30-day `Max-Age`.
  `Lax` is sufficient and necessary: the OAuth callback is a top-level GET
  navigation, which `Lax` permits and `Strict` would break.
- Only the SHA-256 of the token is stored, so a database read cannot
  impersonate anyone.
- Sliding expiry: a session more than a day old is re-stamped on use. The
  session id rotates on login.
- GitHub does not support PKCE, so CSRF protection on the flow is the `state`
  parameter, compared against a separate signed cookie — not stored
  server-side, keeping the flow stateless until a session actually exists.

### Token handling

- `GhTokenService.getUserOctokit(accountId)` is the only way handler code gets
  a GitHub client. It decrypts, checks `access_expires_at` against a 60-second
  skew, refreshes through `@octokit/oauth-methods` when needed, re-encrypts and
  writes back under the existing optimistic-concurrency `version` column.
- Refreshing invalidates the previous token pair, so the write-back must be the
  same transaction that consumes the response; a concurrent-refresh test covers
  this.
- Expired refresh token (6 months, or a revoked install) → credential row
  deleted, session dropped, `401`. The SPA sends the user back through login.
- AES-256-GCM via `node:crypto`, random 12-byte IV per record, IV and auth tag
  stored alongside the ciphertext.

## 7. Frontend

- `routes/login.tsx` — outside `_shell`, so it renders without sidebar or top
  bar. A card with the product mark and one "Continue with GitHub" button that
  is an `<a href="/auth/login">`, not a fetch: the flow is a navigation.
- `_shell.tsx` gains a `beforeLoad` that reads `/ui/me` through TanStack Query
  and `redirect`s to `/login` on 401. The guard sits on the layout route, so
  every current and future view under it inherits it with no per-route work.
- The `AuthProvider`'s account lands in the existing `ShellProvider` context so
  the sidebar footer can show a real avatar and a logout item, replacing the
  placeholder.
- `/login?error=not_invited` renders in place of the button: "This Noesis
  instance is invite-only. Ask an owner to invite `@login`." Signing in is not
  retried automatically — the user is already authenticated with GitHub, so a
  retry loop would just bounce.
- A `GET /ui/me` returning zero installations is a normal state, not an error:
  the account is signed in and has connected nothing yet. The dashboard's empty
  state points at project creation, which is where installations get connected
  — not at a standalone "connect repositories" step.
- The settings view gains a **Members** section, visible to owners only, over
  `/ui/invites`: list pending invites, invite by GitHub login, revoke. It is
  the only place `role` is visible.
- The `hc` client gains a 401 interceptor that redirects to `/login`, so a
  session expiring mid-session does not surface as a broken view.

## 8. Testing

Following the existing split:

- `test/unit/auth.session.spec.ts` — issue, verify, rotate, expire; hash
  storage; against `:memory:`.
- `test/unit/auth.routes.spec.ts` — state mismatch, missing code, GitHub error
  responses. The GitHub HTTP calls are injected as a dependency on the service
  (a `fetch`-shaped function) so the tests need no network and no mock library.
- `test/unit/gh-token.service.spec.ts` — refresh on expiry, no refresh inside
  skew, concurrent refresh, dead refresh token.
- `test/unit/auth.admission.spec.ts` — the four branches of §6's rule: first
  login becomes owner, second uninvited login is rejected with no row written,
  invited login becomes a member and consumes the invite, an already-accepted
  invite does not admit twice. Plus the concurrent-first-login race.
- `test/unit/crypto.spec.ts` — round-trip, tampered ciphertext rejected.
- `test/e2e/auth.e2e.spec.ts` — unauthenticated `/ui/me` is 401; a seeded
  session reaches `/ui/hello`; logout revokes.

`NOESIS_AUTH_MODE=disabled` keeps every existing test untouched.

## 9. Build order

1. Config block, crypto helper, schema tables. No behaviour yet.
2. `SessionService` + `requireSession` + `GET /ui/me`, exercised with seeded
   sessions. No GitHub involved.
3. `/auth/login` + `/auth/callback` against the real GitHub App, in a dev App
   pointed at `http://localhost:3000`. Admission rule lands with the callback —
   it is the callback's first branch, not a later bolt-on.
4. `GhTokenService` refresh path and `getUserOctokit`.
5. Frontend login route, `_shell` guard, sidebar account menu, 401 interceptor.
6. Invites: `/ui/invites` behind `requireOwner`, settings Members section.
7. Installation flow (`/auth/install`, callback) and the installations list on
   `/ui/me`.
8. Railway variables, README section on registering the App.

Steps 1–2 are independently useful and independently reviewable; nothing before
step 3 needs GitHub credentials to exist.

## 10. Not in this change

- **`/api` authentication for the MCP bridge.** The bridge runs on the user's
  laptop with no browser, so its flow is GitHub's device flow (which GitHub
  Apps support) or a Noesis-issued token minted from the settings UI. It is a
  separate decision with its own storage and its own UX, and the `/api` surface
  is already segregated to receive it.
- **Webhooks.** Installation-token minting via `@octokit/auth-app` lands here;
  the webhook receiver and its signature verification arrive with repository
  ingestion.
- **Project creation and its repository picker.** Project CRUD does not exist
  yet; the `UsesInstallation`/`Tracks` relationships, the `Repository` table,
  the org-then-repos picker, and the resume-after-install flow all land with
  it. §5 fixes the shape so that feature has nothing left to decide.
- **Roles beyond owner/member.** `role` is a string so a third value costs no
  migration, but only the two exist and only `requireOwner` reads it.
- **Non-GitHub identity.** Adding a second provider later means a second
  `GhCredential`-shaped node and a provider column on `Account`; nothing in
  this design assumes GitHub is the only one, but nothing accommodates a second
  one either.

## Open questions (resolved 2026-08-13)

- **Project ↔ installation cardinality** — resolved: exactly one installation
  per project, repositories a subset of it. Cross-org projects are not
  supported; a system spanning two orgs is two Noesis projects. See §5.
- **Who registers the GitHub App** — resolved: every deployment registers its
  own, all credentials are configuration. No central infrastructure and no
  secret custody; a hosted Noesis instance later is one more deployment with
  one more config, not a new mechanism. Forced in part by GitHub itself: an App
  carries a fixed callback URL list (max 10), so one App cannot serve arbitrary
  self-hosted origins without a central callback proxy.
- **Who may sign in** — resolved: first login claims the instance as owner,
  everyone after that needs an owner's invite by GitHub login. See §6.
