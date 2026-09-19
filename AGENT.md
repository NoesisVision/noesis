# AGENT.md

This file provides guidance to AI coding agents (Claude Code and others) when working with code in this repository.

## What this is

A pure bun-workspaces monorepo for **Noesis**: a local service that keeps a knowledge graph as JSON files under `.noesis/` in a user's repository, plus the Claude Code plugin that drives it. `README.md` is the full tour; `docs/decisions.md` (D1–D10) is the only decision record and every non-obvious choice cites one — read the relevant D-entry before changing anything it covers.

Workspaces: `server/backend` (`@noesis-vision/noesis`, the service), `server/frontend` (SPA, bundled by the backend), `plugins/claude-code` (`@noesis-vision/claude-code-plugin`). `scanners/java` is a standalone Maven tool; `scanners/dotnet` is a stub.

## Commands

All from the repo root unless noted. bun 1.4 is pinned via `packageManager`.

```sh
bun install                 # also wires .githooks/ via `prepare`
bun run dev                 # Vite on :3000 (HMR) + watched backend on :3001
bun run start:debug         # backend only on :3000 with bun's inspector

bun run ci                  # the one definition of "verified": lint, knip, format:check, check-types, test, test:e2e, build
bun run lint                # oxlint (type-aware + backend layer rules); lint:fix to autofix
bun run format              # oxfmt on code and Markdown; format:check to verify
bun run check-types         # tsc --noEmit in every workspace
bun run knip                # unused files/exports/deps across workspaces
bun run test                # unit + integration in every workspace
bun run test:e2e            # service boot, MCP session, SPA from source
bun run build               # service bundle + plugin contracts copy
bun run generate            # re-stamp version pins; CI fails if the result is not committed
```

Single test: run `bun test` inside the package with a path and/or name filter, e.g.

```sh
cd server/backend && bun test test/unit/validator.spec.ts
cd server/backend && bun test test/unit -t "rejects"
cd server/backend && bun run test:bench          # indexer benchmark (1k/10k files)
cd server/frontend && bun run generate-routes    # tsr generate → src/routeTree.gen.ts (committed)
```

Filter a root script to one package: `bun run --filter=@noesis-vision/noesis build`.

`@ladybugdb/core` is a native module (`trustedDependencies`); `ensureLadybugBinary()` in `platform/native` copies the platform binary at boot when bun skipped the postinstall. `bun run setup:openssl` installs OpenSSL via Homebrew if the native build needs it.

## Architecture in one paragraph

The agent host starts **one stdio MCP process per session** (`server/backend/src/main.ts` is the composition root). That process locates the repo (`NOESIS_ROOT`, else nearest `.git`), owns `.noesis/` (`graph/` = one `<key>/data.json` per object, `tmp/<session>/` scratch, `logs/`), indexes the files into an **in-memory LadybugDB graph that is only a cache** (rebuilt at boot and by a file watcher on every change, including ones Noesis did not make), serves the SPA and `/ui` + `/internal` routes on an ephemeral loopback port, and exits when the host closes stdin. stdout is the MCP transport — never log to it. Files are the source of truth; last write wins across sessions.

### Backend layers (`server/backend/src`, enforced by Oxlint — decision D3)

| Layer     | Folder                                                                                 | May import                                                       |
| --------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| contracts | `app/<feature>/model/`                                                                 | zod and other contracts only (relative imports among themselves) |
| platform  | `platform/` (files, database, logging, crypto, config, native)                         | platform only                                                    |
| app       | `app/` (services, ports, validation registry)                                          | app, contracts                                                   |
| adapters  | `adapters/` (`store/` over `NoesisStore`, `graph/` over LadybugDB, `mcp/`, `scanner/`) | adapters, app, platform, contracts                               |
| ui        | `ui/` (Hono `/ui` and `/internal` routes)                                              | ui, app, platform, contracts                                     |
| root      | `src/*.ts`                                                                             | everything; nothing imports it                                   |

`adapters` and `ui` never import each other; `import/no-cycle` is an error. Cross-directory imports use the `#backend/*` alias (extensionless), relative only within a directory. There is no contracts barrel — import `#backend/app/<feature>/model/<file>` directly.

Services own use-case orchestration; both entry points (MCP tools in `adapters/mcp`, HTTP routes in `ui/`) call them and nothing bypasses them. MCP tools are thin: validate input, call one service method; every tool is registered against a contract in `app/validation/contracts/registry.ts`. Large payloads never travel inline — the agent writes a file under `.noesis/tmp/<session>/`, runs `validate`, passes the path. Validation runs twice with the same schema (the `validate` tool, then again at the write boundary) and errors are returned in-band (`isError`), never as protocol errors.

Keep the `.route()` chains in `app.ts` and `ui.routes.ts` unbroken: `app.types.ts` exports the inferred `/ui` route tree as `AppType`, which the frontend's `hc<AppType>('/ui')` client depends on.

### Contracts (decision D4)

Every knowledge-graph file shape is a zod schema in `server/backend/src/app/<feature>/model/`, and its inferred type is the domain model. They must stay **declarative** (object shapes, enums, `.describe()`; no refinements, transforms, or non-zod imports) because `bun run build` copies them verbatim into `plugins/claude-code/contracts/` (gitignored, byte-identity asserted by a test) where the plugin's skills read them as source. Contract specs live in `test/unit/contracts-*.spec.ts`. Adding a file the `validate` tool should accept means registering it in the registry above.

Backend code reachable from `AppType` (routes, services, contracts) must be runtime-neutral (ECMAScript + Web APIs only) because the frontend type-checks it without Bun/Node types — e.g. ids come from `uuid` v7, not `Bun.randomUUIDv7()`; `node:crypto` hashing lives in `platform/crypto` and only adapters import it.

### Frontend (`server/frontend`, decision D5)

Client-only React 19 SPA: TanStack Router (file-based, `src/routeTree.gen.ts` generated and committed), TanStack Query, Mantine. Rules the linter enforces:

- Route files export `Route` and nothing else; view components live in `src/components/`.
- `@mantine/*` is private to `src/components/design-system/`; everything else imports from `#/components/design-system`.
- Backend imports are **type-only** via `#backend/*` (`AppType`, contract types); never backend runtime code.
- `tsconfig.app.json` has no Bun/Node globals on purpose; tests use `tsconfig.test.json`.

Production has no frontend build of its own: the backend imports `../../frontend/index.html` and bun's fullstack mode bundles it (`bun build` flags and `src/bundle-cwd.ts` are load-bearing). Vite is a dev server only.

### Logging (decision D10, `docs/logging.md`)

LogTape everywhere. Get loggers via `serverLogger('<module>')` / `uiLogger('<module>')`, never by spelling the category array; only `platform/logging/logging.ts` and `frontend/src/logging.ts` call `configure()`. Messages use named placeholders with a properties object (`log.info('indexed {files} files', { files })`), no string interpolation. Service logs go to stderr and `.noesis/logs/noesis.log`; `NOESIS_LOG_LEVEL` sets the level.

### Plugin (`plugins/claude-code`, decision D6)

Skills in `skills/`, contracts copy in `contracts/`, `.mcp.json` launching `${NOESIS_SERVICE_COMMAND:-bunx} ${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}`. Plugin and service release in lockstep (`bun run bump`, `bun run release:beta` from the plugin dir); version pins are stamped by `bun run generate` and must be committed. To develop the plugin against this checkout from another repo: `bun run build:plugin`, then `NOESIS_SERVICE_COMMAND=bun NOESIS_SERVICE_ENTRY=/path/to/server/backend/src/main.ts claude --plugin-dir /path/to/plugins/claude-code`.

## Code style

Keep comments to a minimum. Code should be readable and comprehensible on its own: clear names, small functions and explicit types carry the meaning, not prose beside them. Add a comment only for information that is not present in the code — the reason behind a non-obvious choice, an external constraint (a bun or LadybugDB quirk, a load-bearing build flag), a decision reference (`decision D3`). Never restate what a line does, and remove a comment that no longer says something the code cannot.

## Working conventions (decision D7)

- **Commits:** Conventional Commits with exactly four types — `feat`, `fix`, `improvement` (one-time betterment, behaviour unchanged; covers refactor/perf/docs/tooling), `chore` (recurring maintenance). Subject ≤ 72 chars; `commit-msg` hook rejects anything else. Use the `commit-message` skill. `git commit -n` is the WIP escape hatch for both hooks.
- **Work starts as a task doc** in the narrowest scope's `docs/work/<type>/`, created by the `init-task` skill. Task docs are problem-space only; solution decisions go into `docs/decisions.md`.
- **Changing a decision:** edit the D-entry in place so it states only the new truth, bump the date at the top, move the displaced text to `docs/archive/`. New themes become D11, D12, … Never read `docs/archive/**` (denied in `.claude/settings.json`) unless a person asks for history.
- **Do not edit `bun.lock` by hand** (denied). Shared versions (`typescript`, `zod`, `hono`, `@types/*`) live in the root `package.json` catalog; single-consumer deps stay inline.
- A `PostToolUse` hook runs `oxfmt` and `oxlint` on every file you edit; a lint failure comes back as an error — fix it rather than suppress it. `bun run lint` does not check formatting; `format:check` does.
- Knip: a deliberate duplicate export carries an `@alias` JSDoc tag; entry points Knip cannot discover are listed in `knip.json`.
- Skills live in `.agents/skills/`; `.claude/skills/<name>` is always a relative symlink, never a real directory. Third-party skills are hash-locked in `skills-lock.json` — do not hand-edit them; manage with `npx skills` (see `.agents/README.md`).
- Configuration is exactly `NOESIS_ROOT`, `NOESIS_OPEN_BROWSER=0`, `NOESIS_LOG_LEVEL`, `PORT` (dev only), `NODE_ENV=production` (build). Do not add env vars without a decision.
