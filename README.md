# noesis

A pure [bun](https://bun.sh/) workspaces monorepo containing the Noesis apps, their shared contract packages, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

## 1. Architecture

```
┌────────────────┐   REST    ┌───────────────┐   REST    ┌─────────────────────┐
│ apps/frontend  │ ────────► │ apps/backend  │ ◄──────── │ plugins/mcp-bridge  │
│  React/Vite    │           │  Hono (bun)   │           │  MCP bridge (stdio) │
│    :5173       │           │     :3000     │           │  npm: @noesis-vision│
└────────────────┘           └───────────────┘           │     /mcp-bridge     │
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

| App             | Stack               | Purpose                                              |
| --------------- | ------------------- | ---------------------------------------------------- |
| `apps/frontend` | React 19 + Vite     | Web frontend; typed RPC (`hc<AppType>`) to `backend` |
| `apps/backend`  | Hono on `Bun.serve` | Backend API (port `3000`)                            |

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
bun run dev:apps       # just backend + frontend

bun run build          # build everything
bun run lint           # biome check (lint + format check; `lint:fix` to autofix)
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests
bun run test:e2e       # e2e tests
bun run format         # biome + prettier(md) --write (`format:check` to verify)
```

Filter to one package: `bun run --filter=backend build`.

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
the SPA, `/api/*` for the MCP bridge, `/internal/*` for health and other
technical endpoints — so each surface can carry its own auth later.

- **How it ships:** every green push to `main` triggers the `deploy` job in
  `ci.yml`, which runs `railway up --ci`. Railway builds
  `apps/backend/Dockerfile` (multi-stage `oven/bun`, pinned to `packageManager`,
  repo-root build context) and
  health-checks `/internal/health` (`railway.json`).
- **Configuration:** `RAILWAY_TOKEN` (GitHub Actions secret, a Railway project
  token) and `RAILWAY_SERVICE` (GitHub Actions repository variable, the Railway
  service name). The container needs no service variables — Railway injects
  `PORT`; `UI_DIST_PATH` is baked into the image.
- **Run the production image locally:**

```sh
docker build -f apps/backend/Dockerfile -t noesis-backend .
docker run --rm -p 3000:3000 noesis-backend
```

- **Plugin users** point `NOESIS_SERVER_URL` at the service's generated
  Railway domain (see above).
