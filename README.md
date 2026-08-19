# noesis

A pure [bun](https://bun.sh/) workspaces monorepo containing the Noesis apps, their shared contract packages, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

## 1. Architecture

```
┌─────────────────┐   REST    ┌────────────────┐   REST    ┌─────────────────────┐
│ server/frontend │ ────────► │ server/backend │ ◄──────── │ plugins/mcp-bridge  │
│   React/Vite    │           │   Hono (bun)   │           │  MCP bridge (stdio) │
│     :5173       │           │      :3000     │           │  npm: @noesis-vision│
└─────────────────┘           └────────────────┘           │     /mcp-bridge     │
                                                           └─────────────────────┘
                                                          ▲ launched via bunx by
                                                          │
                                              ┌───────────┴───────────┐
                                              │ plugins/claude-code   │
                                              │ (OpenCode, Codex, ... │
                                              │  planned)             │
                                              └───────────────────────┘
```

### Apps

| App               | Stack               | Purpose                                              |
| ----------------- | ------------------- | ---------------------------------------------------- |
| `server/frontend` | React 19 + Vite     | Web frontend; typed RPC (`hc<AppType>`) to `backend` |
| `server/backend`  | Hono on `Bun.serve` | Backend API (port `3000`)                            |

### The MCP bridge (`plugins/mcp-bridge`)

A **stdio MCP server** (plain TS on bun) bridging coding agents to `backend`
over REST. Published to npm as **`@noesis-vision/mcp-bridge`** — a
self-contained `dist/main.js` bin built at publish time — so every agent
plugin launches the same bridge via `bunx @noesis-vision/mcp-bridge@<version>`
instead of shipping its own copy (decision 33). Versioned in lockstep with the
Claude Code plugin.

### Contract packages — single source of truth for DTOs

All contracts are [zod](https://zod.dev/) schemas with inferred TS types, consumed directly as TypeScript source (no build step):

```
@repo/shared-contracts            DTOs common to all of the below
     ▲                   ▲
@repo/local-contracts   plugins/mcp-bridge/src/contracts
(backend↔bridge)        (MCP tool payloads + registry, owned by the
                        bridge; feeds skill schemas & bridge validation)
```

The backend↔frontend boundary needs no contracts package: the frontend infers
request and response types from the backend's route tree via Hono's
`hc<AppType>` client.

### Plugins (`plugins/`)

One folder per AI harness. `plugins/claude-code` is a [Claude Code plugin](https://code.claude.com/docs/en/plugins) and a workspace member:

- **`skills/prepare-mcp-data/`** — teaches the model how to build MCP payloads; `references/*.schema.json` + `*.example.json` are **generated** by the bridge from its contracts (decision 38)
- **`tools/`** — dev/build tooling (generate, bump, release); not shipped
- **`.mcp.json`** — launches the bridge via `bunx @noesis-vision/mcp-bridge@<version>` (pin stamped by `bun run generate`); target server is configurable via `NOESIS_SERVER_URL` (default `http://localhost:3000`)

The plugin is distributed as the npm package **`@noesis-vision/claude-code-plugin`** (only `.claude-plugin/plugin.json`, `.mcp.json`, and `skills` ship — see the `files` field). The marketplace catalog lives at `plugins/claude-code/.claude-plugin/marketplace.json` and is added by direct URL, so users never clone this monorepo.

### Config packages

- `@repo/typescript-config` — shared tsconfig presets: `base.json`, `vite.json`

Linting and formatting need no config package: a single root `biome.json` covers the whole workspace (per-area rule tweaks live in its `overrides`).

Shared dependency versions (`typescript`, `@biomejs/biome`, `zod`, `hono`, …) are pinned once in the root `package.json` **catalog** — workspaces reference them as `"catalog:"`. Internal packages depend on each other via the `workspace:*` protocol.

### Scanners (`scanners/`)

Planned language scanners (`java/`, `dotnet/`) — not yet implemented and not part of the bun workspace.

## 2. Tools

| Tool                                                                                | Role                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [bun](https://bun.sh/)                                                              | Package manager, TS runtime (apps run TS directly), server bundler, test runner, task orchestration |
| [TypeScript](https://www.typescriptlang.org/)                                       | Everything is TS; internal packages export `src/*.ts` directly                                      |
| [zod](https://zod.dev/) (v4)                                                        | Contract schemas, env validation, JSON Schema generation                                            |
| [Hono](https://hono.dev/) 4                                                         | `backend` app (routing on `Bun.serve`) + typed RPC client (`hc`) in the `frontend` app              |
| [React](https://react.dev/) 19 + [Vite](https://vite.dev/)                          | `frontend` app (Vite dev server proxies `/ui` to the backend; `vite build` emits the SPA it ships)  |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server in `plugins/mcp-bridge`                                                                  |
| [Biome](https://biomejs.dev/) 2                                                     | Linting and formatting (TS/TSX/JS/JSON); Prettier formats Markdown only                             |
| GitHub Actions                                                                      | CI (verify + generated-artifact drift check) and tag-driven npm releases via trusted publishing     |

## 3. Getting started

### Prerequisites

- [bun](https://bun.sh/) ≥ 1.3 (pinned via `packageManager` in `package.json`)

### Setup & daily workflow

```sh
bun install            # install all workspaces

bun run dev            # run all apps in watch mode
bun run dev:server     # just backend + frontend
bun run dev:local      # same, with no GitHub App needed (see below)

bun run build          # build everything
bun run lint           # biome check (lint + format check; `lint:fix` to autofix)
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests
bun run test:e2e       # e2e tests
bun run format         # biome + prettier(md) --write (`format:check` to verify)
```

Filter to one package: `bun run --filter=backend build`.

### Running without a GitHub App

By default the server refuses to start without a GitHub App (see below). Two
modes avoid registering one; both refuse to start with `NODE_ENV=production`,
so neither can leak into a deployment.

**`local` — the real flows against an in-memory GitHub.** Use this for
day-to-day development:

```sh
bun run dev:local
```

That is `dev:server` with `NOESIS_AUTH_MODE=local` and its own
`NOESIS_DATA_DIR` (`.data-local`), kept apart because a project created here is
bound to fake installation and repository ids that a `github`-mode server
cannot make sense of. A `.env` is not needed and, if present, is overridden.

Sign-in, admission, invites, the repo picker and the access check all run their
production code; only the outbound `fetch` is a stand-in
(`server/backend/src/auth/github-fake.ts`, the same one the suites drive). The
sign-in page offers three identities:

| Login     | Reaches                                  |
| --------- | ---------------------------------------- |
| `octocat` | `octocat` (2 repos) and `acme` (4 repos) |
| `alice`   | `acme` only                              |
| `bob`     | `acme` only                              |

The first one to sign in claims the instance as its owner, exactly as in
production — the rest need an invite from Settings → Members, which is how you
exercise the invite flow locally. `/auth/login?as=<login>` picks the identity
directly if you would rather not use the buttons. Credentials are held in
memory, so a restart signs everyone out.

**`disabled` — no auth slice at all.** Every request runs as a fixed local owner
and the GitHub-backed writes (creating a project, connecting a repository,
inviting) answer 503. This is what the suites that spawn the server use:

```sh
NOESIS_AUTH_MODE=disabled bun run dev:server
```

### Registering the GitHub App

Identity is a GitHub App, which is also how Noesis reads repositories
(decision 46). **Every deployment registers its own** — there is no central
Noesis App and no secret custody. Register one at
`https://github.com/settings/apps/new` (or under an organisation's settings):

| Field                                             | Value                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Homepage URL                                      | your `NOESIS_PUBLIC_URL`                                                   |
| Redirect URI (older docs call it "Callback URL")  | `<NOESIS_PUBLIC_URL>/auth/callback`; leave wildcard matching off           |
| Expire user authorization tokens                  | **checked** — Noesis refuses tokens that never expire                      |
| Request user authorization (OAuth) during install | unchecked (sign-in is its own step)                                        |
| Enable Device Flow                                | unchecked — it belongs to the `/api` bridge's own flow, which is not built |
| Setup URL                                         | `<NOESIS_PUBLIC_URL>/auth/install/callback`, with "Redirect on update"     |
| Webhook → Active                                  | **uncheck it** — it defaults on, and the receiver arrives with ingestion   |
| Repository permissions                            | Contents: read-only (Metadata: read-only follows automatically)            |
| Account permissions                               | Email addresses: read-only (optional)                                      |
| Where can this App be installed                   | "Any account" if you need organisation repositories                        |

Without a Setup URL the install screen still works, but GitHub has nowhere to
send the browser afterwards — the installation exists on GitHub and never
registers in Noesis.

Then generate a private key on the App's page and set:

| Variable                      | Where it comes from                                                   |
| ----------------------------- | --------------------------------------------------------------------- |
| `NOESIS_PUBLIC_URL`           | The origin the browser reaches Noesis on; must match the redirect URI |
| `NOESIS_GITHUB_APP_ID`        | The App's numeric id                                                  |
| `NOESIS_GITHUB_APP_SLUG`      | The App's URL slug (`https://github.com/apps/<slug>`)                 |
| `NOESIS_GITHUB_CLIENT_ID`     | The App's client id                                                   |
| `NOESIS_GITHUB_CLIENT_SECRET` | A generated client secret                                             |
| `NOESIS_GITHUB_PRIVATE_KEY`   | The downloaded `.pem`, base64-encoded (`base64 -i key.pem`)           |
| `NOESIS_TOKEN_KEY`            | 32 random bytes, base64 — encrypts GitHub tokens at rest              |
| `NOESIS_AUTH_MODE`            | `github` (default), `local` or `disabled` (neither in production)     |
| `NOESIS_RECOVER_WAL`          | `1` to discard a torn write-ahead log at boot — see below             |

```sh
bun -e "console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())"  # NOESIS_TOKEN_KEY
```

In local development, `NOESIS_PUBLIC_URL` is the **Vite dev server's** origin
(`http://localhost:5173`), not the backend port: sign-in is a navigation, and
the dev server proxies `/auth` and `/ui` through to the backend.

**Who may sign in:** the first account to reach `/auth/login` claims the
instance as its owner. Everyone after that needs an owner to invite them by
GitHub login, from Settings → Members.

### Recovering a torn write-ahead log

If the server dies at boot with
`Runtime exception: Corrupted wal file. Read out invalid WAL record type.`, a
previous process was killed mid-write and LadybugDB's log beside the database
file is unusable. There is no repairing it in place — the process dies on its
first query, restarts, and dies again.

Set `NOESIS_RECOVER_WAL=1` for one boot. The server deletes
`<NOESIS_DATA_DIR>/ladybug-db.wal`, retries, and carries on, **losing the
transactions written since the last checkpoint**. Copy the data directory first
if you want a forensic record. Unset the variable afterwards, so the next torn
log is reported rather than discarded (decision 62).

### Working with contracts

1. Add/edit a zod schema in the right place (`@repo/shared-contracts`, `@repo/local-contracts`, or `plugins/mcp-bridge/src/contracts`).
2. For MCP payloads, register it in `plugins/mcp-bridge/src/contracts/registry.ts`.
3. Regenerate plugin artifacts:

```sh
bun run generate       # refreshes skill schemas/examples, plugin.json version, .mcp.json pin
```

4. **Commit the generated output** — CI (`.github/workflows/ci.yml`) regenerates and fails on any diff.

### Using the Claude Code plugin

The plugin installs from npm — no monorepo clone needed. Add the marketplace by direct URL:

```sh
# in Claude Code:
/plugin marketplace add https://raw.githubusercontent.com/<owner>/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis@noesis        # stable channel
/plugin install noesis-beta@noesis   # beta channel (prerelease builds)
```

> Note: the catalog references the **published npm package** (`@noesis-vision/claude-code-plugin`), so installs track releases, not `main`. The `noesis-beta` entry is pinned to the latest published prerelease. When developing the plugin itself, point a local marketplace entry at the folder instead (`"source": "./"`).

Releasing a new version (from `plugins/claude-code`; the plugin and `@noesis-vision/mcp-bridge` release in lockstep — one version train, decision 33):

```sh
# Beta: one command — bump, generate, smoke-test, commit, tag, push
bun run release:beta            # or: bun run release:beta 0.2.0-beta.1

# Stable: the same steps by hand
bun run bump 0.2.0     # plugin + bridge package.json + matching marketplace channel pin
bun run generate       # stamps .claude-plugin/plugin.json + the .mcp.json bridge pin
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```

The `Release` workflow (`.github/workflows/release.yml`) verifies the tag against both package versions, packs with `bun pm pack` (rewrites `workspace:*`/`catalog:`), and publishes both packages via npm **trusted publishing** (bridge first, so the plugin's pin always resolves) — prereleases land on the `beta` dist-tag, stable versions on `latest`. Testers install with `/plugin install noesis-beta@noesis` (or `npm i @noesis-vision/claude-code-plugin@beta`).

> Local fallback: `bun publish` / `bun run publish:beta` (never raw `npm publish` from the workspace — only the bun pack pipeline rewrites `workspace:*`/`catalog:` versions in the manifest).

Point the MCP server at a different backend per project via `.claude/settings.local.json` (e.g. the deployed Railway domain):

```json
{ "env": { "NOESIS_SERVER_URL": "https://<service>.up.railway.app" } }
```

Payload validation happens in the MCP bridge itself (decision 34): every `tools/call` is checked against its contract's zod schema, and mismatches come back as descriptive in-band tool errors (failing fields + a valid example) so the calling agent can correct itself.

## 4. Deployment

`backend` + `frontend` deploy as **one Railway service**: the Hono backend
serves the built SPA (decisions 17/18/28). Routes are segregated by consumer — `/ui/*` for
the SPA (session-guarded), `/api/*` for the MCP bridge, `/internal/*` for health
and other technical endpoints, `/auth/*` for the GitHub sign-in flow.

- **How it ships:** every green push to `main` triggers the `deploy` job in
  `ci.yml`, which runs `railway up --ci`. Railway builds
  `server/backend/Dockerfile` (multi-stage `oven/bun`, pinned to `packageManager`,
  repo-root build context) and
  health-checks `/internal/health` (`railway.json`).
- **Configuration:** `RAILWAY_TOKEN` (GitHub Actions secret, a Railway project
  token) and `RAILWAY_SERVICE` (GitHub Actions repository variable, the Railway
  service name). Railway injects `PORT`; `UI_DIST_PATH` and `NOESIS_DATA_DIR`
  are baked into the image. The seven `NOESIS_*` GitHub App variables above are
  Railway **service variables** — set them before the first deploy, since the
  server fails fast without them (`NOESIS_PUBLIC_URL` is the service's public
  domain, which must also be the App's registered callback host).
- **Run the production image locally:**

```sh
docker build -f server/backend/Dockerfile -t noesis-backend .
docker run --rm -p 3000:3000 --env-file .env.local noesis-backend
```

- **Plugin users** point `NOESIS_SERVER_URL` at the service's generated
  Railway domain (see above).
