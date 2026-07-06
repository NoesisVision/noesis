# noesis

A pure [bun](https://bun.sh/) workspaces monorepo containing the Noesis apps, their shared contract packages, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

## 1. Architecture

```
┌─────────────┐   REST    ┌─────────────┐   REST    ┌─────────────┐
│  apps/ui    │ ────────► │ apps/server │ ◄──────── │ apps/local  │
│ React/Vite  │           │   NestJS    │           │   NestJS    │
│   :5173     │           │    :3000    │           │ MCP (stdio) │
└─────────────┘           └─────────────┘           └─────────────┘
                                                          ▲ bundled into
                                                          │
                                              ┌───────────┴───────────┐
                                              │ plugins/claude-code   │
                                              │ skills + MCP server   │
                                              └───────────────────────┘
```

### Apps

| App           | Stack           | Purpose                                                                                          |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `apps/ui`     | React 19 + Vite | Web frontend, talks to `server` over REST                                                        |
| `apps/server` | NestJS (on bun) | Backend API (port `3000`)                                                                        |
| `apps/local`  | NestJS (on bun) | Local companion app; hosts the **stdio MCP server** (`src/mcp.ts`) that calls `server` over REST |

### Contract packages — single source of truth for DTOs

All contracts are [zod](https://zod.dev/) schemas with inferred TS types, consumed directly as TypeScript source (no build step):

```
@repo/shared-contracts        DTOs common to all of the below
   ▲           ▲          ▲
@repo/ui-   @repo/local-  @repo/mcp-contracts
contracts   contracts     (MCP tool payloads + registry;
(server↔ui) (server↔local) feeds plugin schemas & validators)
```

### Plugins (`plugins/`)

One folder per AI harness. `plugins/claude-code` is a [Claude Code plugin](https://code.claude.com/docs/en/plugins) and a workspace member:

- **`skills/prepare-mcp-data/`** — teaches the model how to build MCP payloads; `references/*.schema.json` + `*.example.json` are **generated** from `@repo/mcp-contracts`
- **`servers/noesis-local.js`** — self-contained 3.6 MB bundle of `apps/local`'s MCP entry (gitignored; built by `bun run bundle` at pack/test time)
- **`scripts/validate.ts`** — simple script that validates any JSON against a named contract using the real zod schemas in **`contracts/`** (readable copies of `@repo/mcp-contracts`, **generated** by `bun run generate`; zod is a regular plugin dependency)
- **`tools/`** — dev/build tooling (generate, bundle, bump); not shipped
- **`.mcp.json`** — launches the bundled server; target server is configurable via `NOESIS_SERVER_URL` (default `http://localhost:3000`)

The plugin is distributed as the npm package **`@noesis-vision/claude-code-plugin`** (only `.claude-plugin/plugin.json`, `.mcp.json`, `contracts`, `scripts`, `servers`, and `skills` ship — see the `files` field). The marketplace catalog lives at `plugins/claude-code/.claude-plugin/marketplace.json` and is added by direct URL, so users never clone this monorepo.

### Config packages

- `@repo/typescript-config` — shared tsconfig presets: `base.json`, `nest.json`, `vite.json`

Linting and formatting need no config package: a single root `biome.json` covers the whole workspace (per-area rule tweaks live in its `overrides`).

> ⚠️ bun's transpiler does not resolve package-specifier `extends` in tsconfig — the Nest apps duplicate `experimentalDecorators`/`emitDecoratorMetadata` inline. Don't remove those.

Shared tool versions (`typescript`, `@biomejs/biome`, `prettier`, `@types/node`) are pinned once in the root `package.json` **catalog** — workspaces reference them as `"catalog:"`. Internal packages depend on each other via the `workspace:*` protocol.

### Scanners (`scanners/`)

Planned language scanners (`java/`, `dotnet/`) — not yet implemented and not part of the bun workspace.

## 2. Tools

| Tool                                                                                | Role                                                                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [bun](https://bun.sh/)                                                              | Package manager, TS runtime (Nest apps run TS directly), bundler, test runner, task orchestration (`bun run --filter`) |
| [TypeScript](https://www.typescriptlang.org/)                                       | Everything is TS; internal packages export `src/*.ts` directly                                                         |
| [zod](https://zod.dev/) (v4)                                                        | Contract schemas, env validation, JSON Schema generation                                                               |
| [NestJS](https://nestjs.com/) 11                                                    | `server` and `local` apps                                                                                              |
| [React](https://react.dev/) 19 + [Vite](https://vite.dev/)                          | `ui` app                                                                                                               |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server in `apps/local`                                                                                             |
| [Biome](https://biomejs.dev/) 2                                                     | Linting and formatting (TS/TSX/JS/JSON); Prettier formats Markdown only                                                |
| GitHub Actions                                                                      | CI (verify + generated-artifact drift check) and tag-driven npm releases via trusted publishing                        |

## 3. Getting started

### Prerequisites

- [bun](https://bun.sh/) ≥ 1.3 (pinned via `packageManager` in `package.json`)

### Setup & daily workflow

```sh
bun install            # install all workspaces

bun run dev            # run all apps in watch mode
bun run dev:server     # just server + ui

bun run build          # build everything
bun run lint           # biome check (lint + format check; `lint:fix` to autofix)
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests
bun run test:e2e       # e2e tests
bun run format         # biome + prettier(md) --write (`format:check` to verify)
```

Filter to one package: `bun run --filter=server build`.

### Working with contracts

1. Add/edit a zod schema in the right package (`shared-`, `ui-`, `local-`, or `mcp-contracts`).
2. For MCP payloads, register it in `packages/mcp-contracts/src/registry.ts`.
3. Regenerate plugin artifacts:

```sh
bun run generate       # refreshes skill schemas/examples, contract copies, plugin.json version
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

Releasing a new plugin version (from `plugins/claude-code`):

```sh
# Beta: one command — bump, generate, smoke-test, commit, tag, push
bun run release:beta            # or: bun run release:beta 0.2.0-beta.1

# Stable: the same steps by hand
bun run bump 0.2.0     # package.json + matching marketplace channel pin
bun run generate       # stamps .claude-plugin/plugin.json
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```

The `Release` workflow (`.github/workflows/release.yml`) verifies the tag, packs with `bun pm pack` (rewrites `workspace:*`/`catalog:`), and publishes via npm **trusted publishing** — prereleases land on the `beta` dist-tag, stable versions on `latest`. Testers install with `/plugin install noesis-beta@noesis` (or `npm i @noesis-vision/claude-code-plugin@beta`).

> Local fallback: `bun publish` / `bun run publish:beta` (never raw `npm publish` from the workspace — only the bun pack pipeline rewrites `workspace:*`/`catalog:` versions in the manifest).

Point the MCP server at a different backend per project via `.claude/settings.local.json` (e.g. the deployed Railway domain):

```json
{ "env": { "NOESIS_SERVER_URL": "https://<service>.up.railway.app" } }
```

Validate a hand-written payload against a contract (works in-repo and in installed copies):

```sh
bun plugins/claude-code/scripts/validate.ts hello-request path/to/payload.json
```

## 4. Deployment

`server` + `ui` deploy as **one Railway service**: the NestJS server serves the
built SPA (decisions 17/18). Routes are segregated by consumer — `/ui/*` for
the SPA, `/api/*` for the local app / MCP, `/internal/*` for health and other
technical endpoints — so each surface can carry its own auth later.

- **How it ships:** every green push to `main` triggers the `deploy` job in
  `ci.yml`, which runs `railway up --ci`. Railway builds
  `apps/server/Dockerfile` (multi-stage `oven/bun`, pinned to `packageManager`,
  repo-root build context) and
  health-checks `/internal/health` (`railway.json`).
- **Configuration:** `RAILWAY_TOKEN` (GitHub Actions secret, a Railway project
  token) and `RAILWAY_SERVICE` (GitHub Actions repository variable, the Railway
  service name). The container needs no service variables — Railway injects
  `PORT`; `UI_DIST_PATH` is baked into the image.
- **Run the production image locally:**

```sh
docker build -t noesis-server .
docker run --rm -p 3000:3000 noesis-server
```

- **Plugin users** point `NOESIS_SERVER_URL` at the service's generated
  Railway domain (see above).
