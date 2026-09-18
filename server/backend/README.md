# @noesis-vision/noesis

The Noesis **service**: one process per agent session, started by the agent
host (Claude Code via `plugins/claude-code`, OpenCode, Codex, ...) as a
**stdio MCP server**. The same process serves the browser UI over HTTP on an
ephemeral port and opens the default browser on it once at boot. Published to
npm as a self-contained bin — agent plugins launch it with
`bunx @noesis-vision/noesis@<version>` (decision D6).

The knowledge graph files under `.noesis/` in the served repository are the
source of truth; the LadybugDB graph is an in-memory cache rebuilt from them
at boot and on every change. `src/main.ts` is the composition root: config →
`.noesis/` → graph → indexer + watcher → services → HTTP app + MCP server.
stdout belongs to the MCP protocol; logging goes to stderr and to
`.noesis/logs/noesis.log`, with a request id on every line of a request or
a tool call (LogTape, decision D10; conventions in `docs/logging.md`).
When the host
closes stdin the process removes its scratch directory, closes the database
and exits — the UI lives exactly as long as the agent session.

There is no auth and no tenant scoping: the service runs on the developer's
own machine inside one checkout (decision D1).

## Entry points

- **MCP on stdio** (`src/mcp`): thin tools, one service call each —
  `validate`, `list-changes`, `import-conversation`, `import-document`,
  `list-design-docs`, `create-design-doc`, `update-design-doc`,
  `scan-system-model`, `search-knowledge-graph`. Tools take paths, not
  content: the agent writes a working file to the session's scratch
  directory (`.noesis/tmp/<session>/`, named in the server's
  `instructions`), validates it, and passes the path. `validate` and the
  write boundary run the same contract check from
  `src/adapters/validation/contracts`, so what one accepts the other accepts.
- **HTTP** (`src/app.ts`): two Hono surfaces, `/ui` (the SPA's data) and
  `/internal` (health). Every other path is the SPA page: `main.ts` imports
  `../../frontend/index.html` and hands it to `Bun.serve`, so bun bundles
  the page and its assets — on request from source, ahead of time into
  `dist/` on build (decision D5).

## Scripts

```sh
bun run dev         # backend-only watch mode on :3001, no browser
bun run start:debug # same, with bun's inspector attached
bun run build       # one bun build: src/main.ts + the SPA it imports into dist/
bun run start       # run the built dist/main.js bin
bun run check-types # tsc --noEmit
bun run test        # unit tests (test/unit)
bun run test:e2e    # boots the real service over stdio and HTTP (test/e2e)
bun run test:bench  # boot re-index cost at 1k and 10k files (test/bench)
```

Run `dev` here for backend-only development. The repository-root `bun run dev`
starts both workspace scripts: Vite owns port 3000 with hot reloading and
proxies `/ui` and `/internal` to this service on port 3001.
Do not run the backend through `bun run --filter`, which closes the child's
stdin and the service reads that as the MCP session ending.

## Configuration

| Variable              | Meaning                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `NOESIS_ROOT`         | Repository root holding `.noesis/`; defaults to the nearest `.git` above the working dir |
| `NOESIS_OPEN_BROWSER` | `0` keeps the browser closed (headless runs, tests)                                      |
| `PORT`                | Pins the HTTP port; defaults to an ephemeral one                                         |
| `NODE_ENV`            | `production` (set by the build script) turns bun's on-request page bundling off          |

The service refuses to start when neither `NOESIS_ROOT` nor the working
directory yields a git repository.

## Layout

```
src/
  main.ts             composition root, Bun.serve with the SPA and the surfaces, shutdown
  bundle-cwd.ts       moves cwd to the bundle before start (the built bin resolves its
                      asset manifest against cwd, and bunx launches it from the project)
  app.ts              the Hono app: /ui and /internal
  app/                application services and repositories, one folder per kind:
    changes/ design-docs/ system-model/ wiki/
    search/           graph search behind the search tool and /ui/search
    index/            the index service (files → graph at boot and on change)
  ui/                 the HTTP surfaces: /ui/* route apps and /internal (health)
  shared/
    vo/               value objects: the ids the service mints (UUIDv7, content hashes)
  platform/
    config/           env parsing (zod)
    logging/          LogTape setup: stderr + .noesis/logs/noesis.log, request context
    files/            repository root lookup, .noesis/ + its .gitignore, session scratch
                      dir, the generic file repository (atomic whole-file writes), and
                      the watcher that re-indexes on change
    database/         the LadybugDB handle, in-memory only
    native/           puts LadybugDB's native binary where its loader expects it
  adapters/
    schema/           the declarative graph schema, one place for every node/rel table
    validation/       the actionable problem list and the file-contract registry that
                      the validate tool, the ui routes and the MCP tools run
    mcp/              the MCP server and the import service behind its import tools
    scanner/          the TypeScript source scanner behind scan-system-model
test/
  unit/ e2e/ bench/
```

## Package

The package ships `dist/` alone: the self-contained `main.js` bin plus the
SPA's `index.html` and hashed assets, built at pack time by `prepack`. It
carries no readable contracts copy — the service imports
`@repo/shared-contracts` and `bun build` inlines the schemas; the plugin's
`contracts/` is the one copy the agent reads (decision D4). Its only
runtime dependency is the native `@ladybugdb/core`; workspace deps
(`@repo/*`) never leak into the published manifest because `bun pm pack`
rewrites `workspace:*` and `catalog:`.

Its version is bumped in lockstep with the Claude Code plugin by
`plugins/claude-code/tools/bump-version.ts`, and the plugin's `.mcp.json` pin
is stamped from the same version source by `bun run generate` there. The
`v*` tag workflow publishes this package first, so the plugin's pin always
resolves.
