# noesis

A pure [bun](https://bun.sh/) workspaces monorepo containing the Noesis service, the shared contract package, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

Noesis turns conversations and design drafts into a queryable knowledge graph kept as JSON files inside the user's repository, and drives design and implementation work from it. Everything runs on the user's machine; there is no server component.

## 1. Architecture

The target architecture and its diagram are in
[`docs/arch/ARCHITECTURE.md`](docs/arch/ARCHITECTURE.md); decision 68 in
[`docs/decisions.md`](docs/decisions.md) records its adoption, and decisions
69 to 73 the points settled while migrating to it. In one line: the agent
host launches one Noesis service process per session over stdio, that process
serves the browser UI on an ephemeral port, the knowledge graph lives as JSON
files under `.noesis/` in the user's repository, and the in-memory graph
database is a cache rebuilt from those files.

```
agent host (Claude Code) ──stdio/MCP──► @noesis-vision/noesis ◄──HTTP /ui──► browser
   plugins/claude-code                   server/backend + bundled frontend
   skills + contracts                    services, file repositories over .noesis/
                                         in-memory graph (LadybugDB) + watcher + scanner
```

### Apps

| App               | Stack                                 | Purpose                                                     |
| ----------------- | ------------------------------------- | ----------------------------------------------------------- |
| `server/backend`  | Hono on `Bun.serve`, MCP SDK on stdio | The service: MCP tools for the agent, `/ui` for the SPA     |
| `server/frontend` | React 19 + TanStack Router + Mantine  | Web UI (client-only SPA), bundled and served by the service |

### The service (`server/backend`)

One **stdio MCP process per agent session**, started by the agent host. At
boot it locates the repository (`NOESIS_ROOT`, else the nearest `.git` above
the working directory), ensures `.noesis/` and its `.gitignore`, opens its
scratch directory under `.noesis/tmp/<session>/`, indexes the files into the
in-memory graph, binds HTTP on an ephemeral loopback port, opens the browser
once, and connects MCP on stdio. stdout belongs to MCP; logs go to stderr
and to `.noesis/logs/noesis.log` (LogTape, decision 75, `docs/logging.md`).
When the host closes the stream the process removes its scratch directory
and exits: the UI lives exactly as long as the agent session (decision 68).

Inside the process:

- **Services** own use-case orchestration and view assembly; both entry
  points (MCP tools and `/ui` routes) call them and nothing bypasses them.
- **File repositories** own the on-disk layout under `.noesis/`: one
  repository per kind, whole-file atomic writes, `<slug>-<id-suffix>.json`.
- **Graph cache** is LadybugDB (`@ladybugdb/core`) in memory: rebuilt by the
  indexer at boot and by the **file watcher** on every change, including
  ones Noesis did not make (a `git checkout`, a hand edit). Nothing of it
  touches the disk.
- **Scanner** (`src/scanner`) reads the checkout's TypeScript source and
  writes `.noesis/system-model/` plus its graph projection.
- **MCP server** (`src/mcp`) exposes thin tools that call one service
  method each: `validate`, `list-changes`, `import-conversation`,
  `import-document`, `list-design-docs`, `create-design-doc`,
  `update-design-doc`, `scan-system-model`, `search-knowledge-graph`. Tools
  never take content inline: the agent writes a working file to the session
  scratch directory, validates it, and passes the path.
- **HTTP** (`src/app.ts`) has two surfaces, `/ui` for the SPA's data and
  `/internal` for health. Everything else is the SPA page, which the backend
  imports from `server/frontend/index.html` and bun bundles (on request from
  source, ahead of time into `dist/` on build; decision 72).

Published to npm as **`@noesis-vision/noesis`**: `dist/` alone, with the
`main.js` bin, `index.html` and the hashed assets beside it. Every agent
plugin launches it via `bunx @noesis-vision/noesis@<version>`. Versioned in
lockstep with the Claude Code plugin.

### Knowledge graph files (`.noesis/`)

```
<project>/.noesis/
├── .gitignore            written by the service on first run; contains `tmp/`
├── tmp/<session>/        scratch space between agent and service; never versioned
├── graph/changes/<change>/  one directory per change: data.json plus conversations/, documents/, design-docs/
├── system-model/         the implemented model, projected from source by the scanner
└── wiki/                 topics/ and decisions/, distilled from the imports
```

JSON only, one directory per kind, every file committed. The files are the
source of truth and the graph is a cache; two sessions on one checkout are
two processes over the same files, last write wins.

### Contracts — the shapes the agent reads and the service enforces

All contracts are [zod](https://zod.dev/) schemas with inferred TS types in `packages/shared-contracts` (`@repo/shared-contracts`), consumed as TypeScript source. They are declarative on purpose (object shapes, enums, `.describe()` text; no refinements, transforms or imports beyond zod and sibling files), so the agent reads the source directly; what a schema cannot say lives in a companion `.md` beside it (decision 68):

```
packages/shared-contracts/src      every knowledge graph file shape + import payloads,
     │                             with a companion .md per family
     ├─▶ plugins/claude-code/contracts   build-time copy (bun run build / prepack) shipped in
     │                                   the plugin, read by skills; a test asserts byte-identity
     └─▶ server/backend/dist/main.js     imported by the service and bundled into it
server/backend/src/mcp/contracts   the file-contract registry: schema + the whole-document
                                   check the service runs on write; backs the validate tool
```

The service package ships no readable copy (decision 70); the plugin's `contracts/` is the one copy and `tools/copy-contracts.ts` lives beside it (decision 71).

The backend↔frontend boundary needs no contracts package: the backend keeps
its Hono route tree inferable, so the frontend can type its calls with Hono's
`hc` client. The type-only export for it returns with the first frontend
consumer; the bare SPA (decision 67) has none yet.

### Plugins (`plugins/`)

One folder per AI harness. `plugins/claude-code` is a [Claude Code plugin](https://code.claude.com/docs/en/plugins) and a workspace member:

- **`skills/`** — the knowledge-management skills (`import-conversation`, `import-document`, `create-design-doc`, `update-design-doc`, `search-knowledge-graph`) and the implementation skill (`implement-design-doc`); each names the contract it needs by a path under `contracts/`
- **`contracts/`** — the contract sources and companion docs, **copied** from `packages/shared-contracts/src` by `bun run build` with a version header and shipped in the tarball; gitignored except its README (decisions 69, 71)
- **`tools/`** — dev/build tooling (copy-contracts, stamp-plugin-version, bump-version, release-beta); not shipped
- **`.mcp.json`** — launches the service as a stdio MCP server via `${NOESIS_SERVICE_COMMAND:-bunx} ${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}` (pin stamped by `bun run generate`; the two variables point a checkout at the service source, decision 73) with `NOESIS_ROOT` set to the project directory

The plugin is distributed as the npm package **`@noesis-vision/claude-code-plugin`** (only `.claude-plugin/plugin.json`, `.mcp.json`, `contracts` and `skills` ship — see the `files` field). The marketplace catalog lives at `plugins/claude-code/.claude-plugin/marketplace.json` and is added by direct URL, so users never clone this monorepo.

### Config packages

- `@repo/typescript-config` — the shared tsconfig preset `base.json`

Linting and formatting need no config package: a single root `biome.json` covers the whole workspace (per-area rule tweaks live in its `overrides`).

Shared dependency versions (`typescript`, `@biomejs/biome`, `zod`, `hono`, …) are pinned once in the root `package.json` **catalog** — workspaces reference them as `"catalog:"`. Internal packages depend on each other via the `workspace:*` protocol.

### Scanners (`scanners/`)

The TypeScript scanner is a service component (`server/backend/src/scanner`), run by the `scan-system-model` tool; it writes `.noesis/system-model/`. `scanners/java` (a Maven tool, decisions 19/20) and the `dotnet/` stub are not integrated with the service yet — how they feed `system-model/` is a later decision.

### Docs (`docs/`)

- [`docs/decisions.md`](docs/decisions.md) — the architecture decision log; every non-obvious choice in this README cites its number
- [`docs/arch/ARCHITECTURE.md`](docs/arch/ARCHITECTURE.md) — the target architecture and its diagram
- [`docs/stack.md`](docs/stack.md) — the frontend's dependency list and why each is there
- `docs/work/{features,fixes,chores}/` — one task doc per unit of work, created by the `init-task` skill (decision 43); the migration plans live here
- `docs/examples/` — sample domain material used to exercise the skills

## 2. Tools

| Tool                                                                                                              | Role                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [bun](https://bun.sh/)                                                                                            | Package manager, TS runtime (apps run TS directly), bundler for the service and the SPA, test runner     |
| [TypeScript](https://www.typescriptlang.org/) 7                                                                   | Everything is TS, checked by the native (Go) compiler (decision 44); internal packages export `src/*.ts` |
| [zod](https://zod.dev/) (v4)                                                                                      | Contract schemas and env validation                                                                      |
| [Hono](https://hono.dev/) 4                                                                                       | The service's HTTP surfaces on `Bun.serve`; `hc` typed client available to the frontend                  |
| [React](https://react.dev/) 19 + [TanStack Router](https://tanstack.com/router) + [Mantine](https://mantine.dev/) | The SPA; bun's fullstack mode bundles and serves it from the backend (decision 72)                       |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)                               | MCP server in `server/backend/src/mcp`, stdio transport                                                  |
| [LadybugDB](https://www.npmjs.com/package/@ladybugdb/core)                                                        | Embedded graph database, in-memory only, the cache over `.noesis/` (decisions 35, 68)                    |
| [Biome](https://biomejs.dev/) 2                                                                                   | Linting and formatting (TS/TSX/JS/JSON); Prettier formats Markdown only                                  |
| Git hooks (`.githooks/`)                                                                                          | `pre-commit` runs biome + prettier on staged files; `commit-msg` enforces the commit convention          |
| GitHub Actions                                                                                                    | CI (format, verify, generated-artifact drift, Java scanner) and tag-driven npm releases                  |
| [Renovate](https://docs.renovatebot.com/)                                                                         | Weekly dependency PRs (`renovate.json`, decision 37)                                                     |

## 3. Getting started

### Prerequisites

- [bun](https://bun.sh/) 1.4 (pinned via `packageManager` in `package.json`; CI reads the same field)
- JDK 17 + Maven, only for `scanners/java`

### Setup & daily workflow

```sh
bun install            # install all workspaces; `prepare` also points git at .githooks/

bun run dev            # the service in watch mode on :3000, serving the SPA (refresh after edits)
                       # (runs it directly, not through --filter: --filter closes the
                       #  child's stdin, which the service reads as the MCP session ending)
bun run start:debug    # same, with bun's inspector attached

bun run build          # build every workspace (service bundle + plugin contracts copy)
bun run build:plugin   # only copy the contracts into the plugin (for --plugin-dir development)
bun run generate       # re-stamp the version pins (plugin.json, .mcp.json); CI checks they are committed

bun run lint           # biome check (lint + format check; `lint:fix` to autofix)
bun run lint:md        # prettier --check on Markdown
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests (service, contracts, plugin: contracts copy + tarball)
bun run test:e2e       # e2e tests: service boot, MCP session, SPA from source
bun run format         # biome + prettier(md) --write (`format:check` to verify)
bun run ci             # the CI verify job end to end: lint, lint:md, check-types, test, test:e2e, build
```

Filter to one package: `bun run --filter=@noesis-vision/noesis build`. Package-local scripts worth knowing:

| Package               | Script                    | What it does                                                                |
| --------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `server/backend`      | `bun run test:bench`      | Indexer benchmark (1k and 10k files; the boot re-index budget, decision 68) |
| `server/backend`      | `bun run start`           | Run the built `dist/main.js` bin                                            |
| `server/frontend`     | `bun run generate-routes` | `tsr generate`: rewrite the committed `src/routeTree.gen.ts`                |
| `plugins/claude-code` | `bun run bump <version>`  | Bump plugin + service versions and the marketplace channel pin              |
| `plugins/claude-code` | `bun run release:beta`    | Bump, generate, smoke-test the tarball, commit, tag, push                   |

Commits follow Conventional Commits with the four types `feat`, `fix`, `improvement`, `chore` (decision 42); the `commit-msg` hook rejects anything else. `git commit -n` bypasses both hooks for a work-in-progress commit.

### Configuration

The service runs locally inside a single checkout, as part of the Claude plugin.
It has no identity provider and no tenant scoping, so there is nothing to
register and nothing to authenticate against (decision 65).

| Variable              | Meaning                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `NOESIS_ROOT`         | Repository root holding `.noesis/`; defaults to the nearest `.git` above the working directory   |
| `NOESIS_OPEN_BROWSER` | `0` keeps the browser closed at boot (headless runs, tests)                                      |
| `PORT`                | Pins the HTTP port for a stable URL in development (`bun run dev`); defaults to an ephemeral one |
| `NODE_ENV`            | `production` (set by the build script) turns bun's on-request page bundling off                  |

`NOESIS_SERVICE_COMMAND` and `NOESIS_SERVICE_ENTRY` are read by the plugin's `.mcp.json`, not by the service; see below.

### Working with contracts

1. Add/edit a zod schema in `packages/shared-contracts/src`: describe every field, keep it declarative, and update the family's companion `.md` for anything the shape cannot say.
2. For a file the `validate` tool should accept, register it in `server/backend/src/mcp/contracts/registry.ts` (with the service's whole-document check, if it has one).
3. Nothing to regenerate or commit: the plugin copies the sources into `contracts/` on `bun run build` and on pack, and its tests assert the copy matches.

### Using the Claude Code plugin

The plugin installs from npm — no monorepo clone needed. Add the marketplace by direct URL:

```sh
# in Claude Code:
/plugin marketplace add https://raw.githubusercontent.com/NoesisVision/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis@noesis        # stable channel
/plugin install noesis-beta@noesis   # beta channel (prerelease builds)
```

> Note: the catalog references the **published npm package** (`@noesis-vision/claude-code-plugin`), so installs track releases, not `main`. The `noesis-beta` entry is pinned to the latest published prerelease.

Developing the plugin against this checkout, from another repository (decision 73):

```sh
# in the noesis checkout, once and after every contract change
bun run build:plugin                         # copies the contracts into the plugin

# in the sample app repository
NOESIS_SERVICE_COMMAND=bun \
NOESIS_SERVICE_ENTRY=/path/to/noesis/server/backend/src/main.ts \
claude --plugin-dir /path/to/noesis/plugins/claude-code
```

`.mcp.json` launches `${NOESIS_SERVICE_COMMAND:-bunx} ${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}`; the two variables point it at the service source, which runs without a build. The service serves the repository Claude Code starts in. The local plugin overrides an installed `noesis` for that session; `/reload-plugins` picks up skill edits and restarts the service.

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

The `Release` workflow (`.github/workflows/release.yml`) runs the verify steps, checks the generated pins are committed, verifies the tag against both package versions, packs with `bun pm pack` (rewrites `workspace:*`/`catalog:`; the plugin's `prepack` copies the contracts), and publishes both packages via npm **trusted publishing** (service first, so the plugin's pin always resolves) — prereleases land on the `beta` dist-tag, stable versions on `latest`. Testers install with `/plugin install noesis-beta@noesis` (or `npm i @noesis-vision/claude-code-plugin@beta`).

> Local fallback: `bun publish` / `bun run publish:beta` (never raw `npm publish` from the workspace — only the bun pack pipeline rewrites `workspace:*`/`catalog:` versions in the manifest).

Payload validation happens twice in the service (decision 68): the `validate` tool checks a working file against its contract and reports actionable errors (path, expected versus found, a one-line correction, capped list), and every write runs the same check again at the boundary, so what `validate` says and what a write rejects are the same.

### CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:

- **Format check** — ungated, so doc-only commits are still checked (prettier on Markdown, biome on code)
- **Lint, type-check, test, build** — gated on TS-side changes (`server/**`, `packages/**`, `plugins/**`, root manifests)
- **Generated output is committed** — `bun run generate` must leave the tree clean (the version pins; the contracts copy is not committed, decision 69)
- **Java scanner build** — `mvn verify`, gated on `scanners/java/**`

## 4. Distribution

There is no deployment: the service runs on the user's machine, one process
per agent session (decision 68). What ships is two npm packages, released in
lockstep by the `v*` tag workflow (`.github/workflows/release.yml`, trusted
publishing):

- **`@noesis-vision/noesis`** — the service: `dist/` with the `main.js` bin
  and the SPA's page and assets beside it.
- **`@noesis-vision/claude-code-plugin`** — the plugin: skills, the
  `contracts/` copy, and `.mcp.json` pinning the service version.

See `plugins/claude-code/README.md` for the release procedure.
