# noesis

A pure [bun](https://bun.sh/) workspaces monorepo containing the Noesis apps, their shared contract packages, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

## 1. Architecture

The target architecture and its diagram are in
[`docs/arch/ARCHITECTURE.md`](docs/arch/ARCHITECTURE.md); decision 68 in
[`docs/decisions.md`](docs/decisions.md) records its adoption. In one line:
the agent host launches one Noesis service process per session over stdio,
that process serves the browser UI on an ephemeral port, the knowledge graph
lives as JSON files under `.noesis/` in the user's repository, and the embedded
graph database is a cache rebuilt from those files.

```
agent host (Claude Code) ──stdio/MCP──► @noesis-vision/noesis ◄──HTTP /ui──► browser
   plugins/claude-code                   server/backend + built frontend
   skills + contracts                    file repositories over .noesis/
                                         in-memory graph + watcher + scanner
```

### Apps

| App               | Stack                      | Purpose                  |
| ----------------- | -------------------------- | ------------------------ |
| `server/frontend` | React 19 + TanStack Router | Web frontend (Vite SPA)  |
| `server/backend`  | Hono on `Bun.serve`        | The service: MCP + `/ui` |

### The service (`server/backend`)

One **stdio MCP process per agent session**, started by the agent host. It
holds the services, the file repositories over `.noesis/`, the in-memory graph
cache and its watcher, and serves the browser UI over HTTP on an ephemeral
port. Published to npm as **`@noesis-vision/noesis`** — a self-contained
`dist/main.js` bin plus the built ui — so every agent plugin launches it via
`bunx @noesis-vision/noesis@<version>` (decision 68). Versioned in lockstep
with the Claude Code plugin.

### Contracts — the shapes the agent reads and the service enforces

All contracts are [zod](https://zod.dev/) schemas with inferred TS types, consumed as TypeScript source. They are declarative on purpose (object shapes, enums, `.describe()` text; no refinements, transforms or imports beyond zod and sibling files), so the agent reads the source directly; what a schema cannot say lives in a companion `.md` beside it (decision 68):

```
packages/shared-contracts/src      every knowledge graph file shape + import payloads,
     │                             with a companion .md per family
     ├─▶ plugins/claude-code/contracts   build-time copy (bun run build / prepack) shipped in
     │                                   the plugin, read by skills; a test asserts byte-identity
     └─▶ server/backend/dist/main.js     imported by the service and bundled into it
server/backend/src/mcp/contracts   the file-contract registry: schema + the whole-document
                                   check the service runs on write; backs the validate tool
```

The backend↔frontend boundary needs no contracts package: the frontend infers
request and response types from the backend's route tree via Hono's
`hc<AppType>` client.

### Plugins (`plugins/`)

One folder per AI harness. `plugins/claude-code` is a [Claude Code plugin](https://code.claude.com/docs/en/plugins) and a workspace member:

- **`contracts/`** — the contract sources and companion docs, **copied** from `packages/shared-contracts/src` by `bun run build` with a version header and shipped in the tarball; gitignored except its README; skills name a contract by this path (decisions 68, 69)
- **`tools/`** — dev/build tooling (generate, bump, release); not shipped
- **`.mcp.json`** — launches the service as a stdio MCP server via `bunx @noesis-vision/noesis@<version>` (pin stamped by `bun run generate`) with `NOESIS_ROOT` set to the project directory

The plugin is distributed as the npm package **`@noesis-vision/claude-code-plugin`** (only `.claude-plugin/plugin.json`, `.mcp.json`, `contracts` and `skills` ship — see the `files` field). The marketplace catalog lives at `plugins/claude-code/.claude-plugin/marketplace.json` and is added by direct URL, so users never clone this monorepo.

### Config packages

- `@repo/typescript-config` — shared tsconfig presets: `base.json`, `vite.json`

Linting and formatting need no config package: a single root `biome.json` covers the whole workspace (per-area rule tweaks live in its `overrides`).

Shared dependency versions (`typescript`, `@biomejs/biome`, `zod`, `hono`, …) are pinned once in the root `package.json` **catalog** — workspaces reference them as `"catalog:"`. Internal packages depend on each other via the `workspace:*` protocol.

### Scanners (`scanners/`)

The TypeScript scanner is a service component (`server/backend/src/scanner`), run by the `scan-system-model` tool; it writes `.noesis/system-model/`. `scanners/java` (a Maven tool, decisions 19/20) and the `dotnet/` stub are not integrated with the service yet — how they feed `system-model/` is a later decision.

## 2. Tools

| Tool                                                                                | Role                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [bun](https://bun.sh/)                                                              | Package manager, TS runtime (apps run TS directly), server bundler, test runner, task orchestration |
| [TypeScript](https://www.typescriptlang.org/)                                       | Everything is TS; internal packages export `src/*.ts` directly                                      |
| [zod](https://zod.dev/) (v4)                                                        | Contract schemas, env validation, JSON Schema generation                                            |
| [Hono](https://hono.dev/) 4                                                         | `backend` app (routing on `Bun.serve`) + typed RPC client (`hc`) in the `frontend` app              |
| [React](https://react.dev/) 19 + [Vite](https://vite.dev/)                          | `frontend` app (Vite dev server proxies `/ui` to the backend; `vite build` emits the SPA it ships)  |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server in `server/backend/src/mcp`                                                              |
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

bun run build          # build everything
bun run lint           # biome check (lint + format check; `lint:fix` to autofix)
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests
bun run test:e2e       # e2e tests
bun run format         # biome + prettier(md) --write (`format:check` to verify)
```

Filter to one package: `bun run --filter=@noesis-vision/noesis build`.

### Configuration

The server runs locally inside a single checkout, as part of the Claude plugin.
It has no identity provider and no tenant scoping, so there is nothing to
register and nothing to authenticate against (decision 65).

| Variable              | Meaning                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `NOESIS_ROOT`         | Repository root holding `.noesis/`; defaults to the nearest `.git` above the working directory |
| `NOESIS_OPEN_BROWSER` | `0` keeps the browser closed at boot (headless runs, tests)                                    |
| `PORT`                | Pins the HTTP port for the Vite dev proxy (`bun run dev`); defaults to an ephemeral one        |
| `UI_DIST_PATH`        | Serve the SPA from this directory instead of the packaged `ui/` (development only)             |

### Working with contracts

1. Add/edit a zod schema in `packages/shared-contracts/src`: describe every field, keep it declarative, and update the family's companion `.md` for anything the shape cannot say.
2. For a file the `validate` tool should accept, register it in `server/backend/src/mcp/contracts/registry.ts` (with the service's whole-document check, if it has one).
3. Nothing to regenerate or commit: the plugin copies the sources into `contracts/` on `bun run build` and on pack, and its tests assert the copy matches.

### Using the Claude Code plugin

The plugin installs from npm — no monorepo clone needed. Add the marketplace by direct URL:

```sh
# in Claude Code:
/plugin marketplace add https://raw.githubusercontent.com/<owner>/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis@noesis        # stable channel
/plugin install noesis-beta@noesis   # beta channel (prerelease builds)
```

> Note: the catalog references the **published npm package** (`@noesis-vision/claude-code-plugin`), so installs track releases, not `main`. The `noesis-beta` entry is pinned to the latest published prerelease. When developing the plugin itself, point a local marketplace entry at the folder instead (`"source": "./"`).

Releasing a new version (from `plugins/claude-code`; the plugin and `@noesis-vision/noesis` release in lockstep — one version train, decisions 33 and 68):

```sh
# Beta: one command — bump, generate, smoke-test, commit, tag, push
bun run release:beta            # or: bun run release:beta 0.2.0-beta.1

# Stable: the same steps by hand
bun run bump 0.2.0     # plugin + service package.json + matching marketplace channel pin
bun run generate       # stamps .claude-plugin/plugin.json + the .mcp.json service pin
git commit -am "Release 0.2.0"
git tag -a v0.2.0 -m "Release 0.2.0" && git push origin main v0.2.0
```

The `Release` workflow (`.github/workflows/release.yml`) verifies the tag against both package versions, packs with `bun pm pack` (rewrites `workspace:*`/`catalog:`), and publishes both packages via npm **trusted publishing** (service first, so the plugin's pin always resolves) — prereleases land on the `beta` dist-tag, stable versions on `latest`. Testers install with `/plugin install noesis-beta@noesis` (or `npm i @noesis-vision/claude-code-plugin@beta`).

> Local fallback: `bun publish` / `bun run publish:beta` (never raw `npm publish` from the workspace — only the bun pack pipeline rewrites `workspace:*`/`catalog:` versions in the manifest).

Payload validation happens in the service's MCP server (decision 34): every `tools/call` is checked against its contract's zod schema, and mismatches come back as descriptive in-band tool errors (failing fields + a valid example) so the calling agent can correct itself.

## 4. Distribution

There is no deployment: the service runs on the user's machine, one process
per agent session (decision 68). What ships is two npm packages, released in
lockstep by the `v*` tag workflow (`.github/workflows/release.yml`, trusted
publishing):

- **`@noesis-vision/noesis`** — the service: `dist/main.js` bin, the built
  frontend in `ui/`, the contract sources in `contracts/`.
- **`@noesis-vision/claude-code-plugin`** — the plugin: skills, the
  `contracts/` copy, and `.mcp.json` pinning the service version.

See `plugins/claude-code/README.md` for the release procedure.
