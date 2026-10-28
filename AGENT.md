# AGENT.md

This file provides guidance to AI coding agents (Claude Code and others) when working with code in this repository.

## What this is

A pure bun-workspaces monorepo for **Noesis**: a local service that keeps a knowledge graph as JSON files under `.noesis/` in a user's repository, plus the Claude Code plugin that drives it.

Workspaces: `server/backend` (`@noesis-vision/noesis`, the service, private: it ships inside the plugin), `server/frontend` (SPA, bundled by the backend), `plugins/claude-code` (`@noesis-vision/claude-code-plugin`). Naming: the **scanner** is the whole module that turns a repository into a system model (`app/scanners/`); a **parser** reads source code into the common code model (the tools under `code-parsers/`, run through the adapters in `adapters/out/scanners/code-parsers/`); the **system model builder** builds the system model from the code model (`app/scanners/system-model-builders/`, rules in `docs/plans/code-model-to-system-model.md`). `code-parsers/dotnet` is a standalone .NET 10 solution (`dotnet test` from that directory; see its README) that parses a C# solution with Roslyn into the common code model; the service's `csharp` parser runs it as `noesis-parse-csharp`. `code-parsers/java` is a standalone Maven build (`mvn -B verify` from that directory; see its README) whose `noesis:parse` plugin writes the same code model for a Maven project, through a javac source engine or an ArchUnit bytecode engine; design in `docs/plans/code-model-java-parser.md`. `code-parsers/java/gradle-plugin` is a Gradle build beside it (`./gradlew build` there, after `mvn install`) that wraps the same engines as the `vision.noesis.parser` plugin's `noesisParse` task for Gradle builds. Both plugins and the annotations are released to Maven Central on `java-v*` tags (`.github/workflows/release-java.yml`); the examples take the released `0.1.0`, while the repository stays on `0.1.0-SNAPSHOT`. A Java repository declares the Maven or Gradle plugin in its build, with the engine in its configuration, and its `.noesis/settings.json` runs it through `"parser": { "language": "java", "command": [...] }`: the command line in the parser's settings (`./mvnw … process-classes noesis:parse` in `examples/qdoc-java`, `./gradlew noesisParse` in `examples/discounts-java`), whose code model the system model builder reads by the manifest's language, Java's by `app/scanners/system-model-builders/java.vocabulary.ts`. The service holds no Maven or Gradle knowledge. The scan is domain logic: `Scanner` (`app/scanners/scanner.ts`) runs a `CodeParser`, then the `SystemModelBuilder`; the adapters are only parsers (`adapters/out/scanners/code-parsers/`: `CSharpParser`, `JavaParser`), which share `command-code-parser.ts`.

## Commands

All from the repo root unless noted. bun 1.4 is pinned via `packageManager`.

```sh
bun install                 # also wires .githooks/ via `prepare`
bun run dev                 # Vite on :3000 (HMR) + watched backend on :3001
bun run preview             # build, then serve the production artifacts on :3000
bun run start:debug         # backend only on :3000 with bun's inspector

bun run ci                  # the one definition of "verified" (the pre-push hook): lint, knip, format:check, check-types, test, test:e2e, build
bun run lint                # oxlint (type-aware + backend layer rules); lint:fix to autofix
bun run format              # oxfmt on code and Markdown; format:check to verify
bun run check-types         # tsc --noEmit in every workspace
bun run knip                # unused files/exports/deps across workspaces
bun run test                # unit + integration in every workspace, one workspace at a time
bun run test:e2e            # service boot, MCP session, SPA from source
bun run test:e2e:toolchain  # the C# and Java parsers end to end; needs .NET and Maven, so not in ci (pre-push) but in GitHub CI
bun run build               # vite build of the SPA + service bundle + plugin contracts (JSON Schema)
bun run generate            # re-stamp version pins; CI fails if the result is not committed
```

`test` walks the workspaces one at a time instead of with `--filter '*'`, which runs them at once: the plugin's tarball suite builds the service, and that build empties `server/frontend/dist` and `server/backend/dist`, so a suite reading the page beside it would lose it mid-run.

Single test: run `bun test` inside the package with a path and/or name filter, e.g.

```sh
cd server/backend && bun test test/unit/session-dir.spec.ts
cd server/backend && bun test test/unit -t "rejects"
cd server/frontend && bun run generate-routes    # tsr generate → src/routeTree.gen.ts (committed)
cd server/frontend && bun run build:spa          # vite build → server/frontend/dist (the page the service serves)
```

Filter a root script to one package: `bun run --filter=@noesis-vision/noesis build`.

## Architecture in one paragraph

The agent host starts **one stdio MCP process per session** (`server/backend/src/main.ts` is the composition root). That process locates the repo (`NOESIS_ROOT`, else nearest `.git`), owns `.noesis/` (`graph/` = one `<id>.<kind>.json` per entity, a change's documents and design docs in `graph/changes/<change>/` beside `<change>.change.json`, `sessions/<session>/` scratch, `logs/`), reads them directly on every request (no index, no watcher), serves the SPA and `/ui` + `/internal` routes on an ephemeral loopback port, and exits when the host closes stdin. stdout is the MCP transport — never log to it. Files are the source of truth, and there are no locks: a create is exclusive across sessions too (a hard link the filesystem refuses when the name is taken), so no two writers take one id; an update replaces only a file that is there and a removal removes only one, each checking and writing in one synchronous step; beyond that, the last write wins across sessions.

### Backend layers (`server/backend/src`, enforced by Oxlint)

| Layer    | Folder                                                                                                     | May import                     |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| platform | `platform/` (files, http, logging, config)                                                                 | platform only                  |
| app      | `app/` (the domain model and its zod schemas, handlers, ports, file contracts)                             | app                            |
| adapters | `adapters/` (`out/store/` over `JsonCollection`, `out/scanners/` (code parsers, Git, scan log), `in/mcp/`) | adapters, app, platform        |
| ui       | `adapters/in/ui/` (Hono `/ui` and `/internal` routes)                                                      | ui, app, platform              |
| root     | `main.ts` and `boot/` (the composition root: workspace, handlers, MCP, ui)                                 | everything; nothing imports it |

`adapters` and `ui` never import each other; `import/no-cycle` is an error. Cross-directory imports use the `#backend/*` alias (extensionless), relative only within a directory. There is no contracts barrel — import `#backend/app/<feature>/<file>` directly.

Use cases are handlers, one per command or query: a module in `app/<feature>/` named for the use case (`create-change.ts`, `find-design-doc.ts`) exports the command's zod schema, the `Handler<Input, Output>` (`app/handler.ts`) alias and a factory that closes over the repositories it needs. `boot/services.ts` wires them; both entry points (MCP tools in `adapters/in/mcp`, HTTP routes in `adapters/in/ui`) call them and nothing bypasses them. A route takes its params and body schemas from the command's schema. The MCP surface is the **v2** SDK's `McpServer` (`@modelcontextprotocol/server`; the monolithic `@modelcontextprotocol/sdk` is gone) composed in `adapters/in/mcp/mcp-server.ts`, with one module per tool under `adapters/in/mcp/tools/`; a tool declares a title, a description, zod input and output schemas and its annotations, then hands one command to one handler and answers with `structuredContent`. It currently offers `create_change`, `update_change`, `delete_change` (which removes a change with everything it owns), `list_changes`, a create and an update tool for documents and for design documents (`create_document_in_change`, `update_document_in_change`, `create_design_doc_in_change`, `update_design_doc_in_change`), `list_documents_in_change` and `get_document_in_change`, which read a change's documents back, `list_design_docs_in_change` and `get_design_doc_in_change`, which read its design documents back (the get answers inline, or, given a `workingFile` name, writes the design document into the session's scratch directory as the working file the update reads and answers with its path), `scan_system_model`, which runs the configured scanner and stores the system model it finds as a new scan at a server-minted UUIDv7 (every scan is kept), and `get_newest_system_model`, which answers with the one scanned last, found by the highest id among the file names without reading the others; it grows one tool at a time. stdio goes through `serveStdio(factory)`, which serves the 2026-07-28 revision and the 2025 era from the same factory. Nothing process-specific belongs in `instructions`: the SDK probes the era on a throwaway sibling process and the client keeps _its_ instructions, so the live session directory is named in the tool's `path` description instead. The `ui/` surface writes what a person may: it creates a change (`POST /ui/changes`), revises a design document as a human (`PUT …/design-docs/:id`, so fields may carry `author: 'human'`, which an agent's write may not, except to keep a field a human wrote or accepted exactly as the version it replaces holds it), and adds or removes a document (`POST …/documents`, `DELETE …/documents/:id`); design documents are created only through the MCP tools. A write route takes the same schema the matching tool reads a working file with, through `jsonBody` and `workingFileLimit` (`adapters/in/ui/json-body.ts`). The app refuses a `Host` other than this machine (DNS rebinding) and, through Hono's `csrf()`, a form-style write from another site. Working files carry no id: a create mints the dated id on the server and answers with it, and an update takes the id as an argument and refuses an unknown one in-band. Large payloads never travel inline — the agent writes a file under `.noesis/sessions/<session>/` and passes the path. A tool that reads such a file checks it against its contract with `readJsonFile` (`platform/files/json-file.ts`, the same codec the graph is read with) before the handler sees it; there is no separate validating tool. Errors the server can foresee are returned in-band (`isError`), never as protocol errors: a working file that does not fit carries a capped issue list (`z.prettifyError`: message and path), and the domain errors a handler throws (a missing entity, a design that breaks its rules) are answered once, in `logged` (`adapters/in/mcp/tool-handler.ts`), with what to do next, so no tool catches. Ids are value-object schemas in each tool's input, so the SDK refuses an argument that is not one in-band, with the schema's message. On `/ui`, `answerError` (`adapters/in/ui/error-body.ts`) is the one place an error becomes a status and a body.

Keep the `.route()` chains in `boot/app.ts` and `ui.routes.ts` unbroken: `boot/app.types.ts` exports the inferred `/ui` route tree as `AppType`, which the frontend's `hc<AppType>('/ui')` client depends on.

### Contracts

Every knowledge-graph file shape is a zod schema in its feature folder, `server/backend/src/app/<feature>/`, next to the handlers and domain objects that use it; no folder is reserved for schemas, and its inferred type is the domain model. They must stay **declarative** (object shapes, enums, `.describe()`; no refinements or transforms) because the JSON Schema an agent reads is generated from them, and JSON Schema would drop a refinement or transform silently (`test/unit/contracts-json-schema.spec.ts` refuses one). The contracts that ship are listed in `server/backend/tools/contracts.ts`, by the name they ship under; add a line there when a skill needs a new one. `bun run contracts <dir>` writes them, and the plugin's `bun run build` calls it into `plugins/claude-code/contracts/` (gitignored). Only schemas ship; a domain object beside them, like `DocumentId`, stays in the app layer. Contract specs live in `test/unit/contracts-*.spec.ts`. The code model (`app/scanners/code-parsers/code-model.ts`) is a contract for parsers, not agents, and ships no JSON Schema: the parsers keep their own copies, and `test/unit/code-model-schema.spec.ts` parses their golden files with it. A route that writes a file gives its schema to `sValidator`. Whole-document rules a schema cannot express have no home today: the design document's integrity pass went with its authoring tool and comes back with it.

Backend code reachable from `AppType` (routes, handlers, contracts) must be runtime-neutral (ECMAScript + Web APIs only) because the frontend type-checks it without Bun/Node types — e.g. ids come from `uuid` v7, not `Bun.randomUUIDv7()`. When a handler's implementation must reach runtime code, the routes import its `Handler` alias from a separate `<use-case>.port.ts` (`app/scanners/scan-system-model.port.ts`), so the frontend's type graph stops at the contract and the implementation keeps its real types.

### Frontend (`server/frontend`)

Client-only React SPA. Rules the linter enforces:

- Partitioned by domain, enforced by `boundaries`: `src/features/<domain>/` (`<domain>.api.ts`, `<domain>.model.ts`, `ui/`), `src/shell/` (chrome and navigation), `src/shared/` (client, design system, routing ids), `src/routes/` (wiring only).
- The shell composes features; no feature imports the shell. A feature is reached through its `*.api.ts` / `*.model.ts`, never its `ui/` — inside a feature, import siblings relatively; `#/` means crossing a module.
- Route files export `Route` and nothing else, with a **literal** route id (`tsr generate` rejects an imported constant); the typed ids live in `src/shared/routing/route-ids.ts`.
- `@mantine/*` is private to `src/shared/design-system/`; everything else imports from `#/shared/design-system`.
- Backend imports are **type-only** via `#backend/*` (`AppType`, contract types); never backend runtime code.
- `tsconfig.app.json` has no Bun/Node globals on purpose; tests use `tsconfig.test.json`.

The SPA is built by **vite** (`bun run --cwd server/frontend build:spa` → `server/frontend/dist`) and the backend serves it from disk through `platform/http/static-assets.ts`, which gzips and caches each file once and falls back to `index.html` for client routes. The backend's `build` runs the vite build first and copies its output to `dist/ui/`; nothing imports `index.html` any more, because bundling it flattened mermaid's ~80 on-demand diagram chunks into one 6.5 MB file. Only the frontend's `build:spa` builds the page — the name is deliberately not `build`, so a `--filter '*' build` cannot start a second vite build beside the one the backend runs. The root `build` is the plugin's build alone: it builds the service itself, so running the backend's build beside it would race over `dist/`. A backend-only run (`start:debug`, `test:e2e`) builds the page first and serves that build, so frontend edits need a rebuild; `bun run dev` serves the page from vite on :3000 as before.

### Logging

LogTape everywhere. Get loggers via `serverLogger('<module>')` / `uiLogger('<module>')`, never by spelling the category array; only `platform/logging/logging.ts` and `frontend/src/logging.ts` call `configure()`. Messages use named placeholders with a properties object (`log.info('indexed {files} files', { files })`), no string interpolation. Service logs go to stderr and `.noesis/logs/noesis.log`; `NOESIS_LOG_LEVEL` sets the level.

### Plugin (`plugins/claude-code`)

Generated JSON Schema contracts in `contracts/`, the built service in `server/` (`main.js` and `ui/`, copied from `server/backend/dist/` by the plugin's `bun run build`; both gitignored), `.mcp.json` launching `bun ${NOESIS_SERVICE_ENTRY:-${CLAUDE_PLUGIN_ROOT}/server/main.js}`. The plugin is the only published package; `bun run bump` keeps the service's version equal to the plugin's, because the service reports it over MCP (`bun run release:beta` from the plugin dir). The `plugin.json` version is stamped by `bun run generate` and must be committed. To develop the plugin against this checkout from another repo: `bun run build:plugin`, then `NOESIS_SERVICE_ENTRY=/path/to/server/backend/src/main.ts claude --plugin-dir /path/to/plugins/claude-code`.

## Code style

Keep comments to a minimum. Code should be readable and comprehensible on its own: clear names, small functions and explicit types carry the meaning, not prose beside them. Add a comment only for information that is not present in the code — the reason behind a non-obvious choice or an external constraint (a bun or LadybugDB quirk, a load-bearing build flag). Never restate what a line does, and remove a comment that no longer says something the code cannot.

Structure classes so the public surface reads as a sequence of steps (`NoesisDir` in `platform/files` and `SessionDir` in `adapters/in/mcp` are the reference):

- **Public methods compose, private methods do.** A public method's body is a short sequence of calls to private methods, one per meaningful step, each named for what it achieves (`createDirectories()`, `excludeUnversionedDirsFromGit()`), not how. A public name must say what happens: `ensureInitialized()`, not `ensure()`.
- **Instance or module.** A helper that needs `this` is a private method; one that does not is a plain function at the bottom of the module (`isInside`, `realpathIfExists`).
- **Value objects for domain primitives.** An id, name, slug or quantity is a branded Zod schema with its factories beside it, as `app/element-id.ts` does; the `value-objects` skill has the rules.
- **Small classes for private helper data.** When a few helpers in one file all work on the same value that never leaves it, give it a small class with a private constructor and a static factory (`MissingLines.of(...)`). Keep it unexported.
- **Interfaces only at real seams (backend).** Declare an interface only where the code needs one: a port in `app/` that an adapter fulfils (`SystemModelsRepository`, `SourceRepository`, `ScanLog`), a contract with several real implementations (`CodeParser`), or the contract an entry point depends on (`Handler`). Everywhere else, depend on the concrete class (`ScannerFactory`, `Scanner`). Never add an interface only to make a test fake fit; build the fake through one helper in `test/support/` instead (`fakeScannerFactory`).
- **Implement interfaces explicitly (backend).** A class that fulfils an interface declares it with `implements` (`GitSourceRepository implements SourceRepository`). Never let structural typing alone connect a class to an interface it was written for: the mismatch must be reported at the class, and the link must be visible in the code. A factory that returns an object literal gives the interface as its return type (`): ScanSystemModelHandler`).
- **No exceptions for control flow.** Prefer APIs that report absence (`Bun.file(path).exists()`) over catching `ENOENT`/`EEXIST`. Where only a throwing API exists, confine the catch to one helper that returns `null` or `boolean` and rethrows every other error code. A benign race is acceptable in exchange for plainer flow; say so in a one-line comment.

## Working conventions

- **Commits:** Conventional Commits with exactly four types — `feat`, `fix`, `improvement` (one-time betterment, behavior unchanged; covers refactor/perf/docs/tooling), `chore` (recurring maintenance). Subject ≤ 72 chars; `commit-msg` hook rejects anything else. Use the `commit-message` skill. Commits are not code-checked; the `pre-push` hook runs `lint`, `knip`, `format:check`, `check-types` and `test` before every push.
- **Do not edit `bun.lock` by hand** (denied). Shared versions (`typescript`, `zod`, `hono`, `@types/*`) live in the root `package.json` catalog; single-consumer deps stay inline.
- A `PostToolUse` hook runs `oxfmt` and `oxlint` on every file you edit; a lint failure comes back as an error — fix it rather than suppress it. `bun run lint` does not check formatting; `format:check` does.
- Knip: a deliberate duplicate export carries an `@alias` JSDoc tag; entry points Knip cannot discover are listed in `knip.json`.
- Skills live in `.agents/skills/`; `.claude/skills/<name>` is always a relative symlink, never a real directory. Third-party skills are hash-locked in `skills-lock.json` — do not hand-edit them; manage with `npx skills`.
- Configuration is exactly `NOESIS_ROOT`, `NOESIS_OPEN_BROWSER=0`, `NOESIS_LOG_LEVEL`, `PORT` (dev only), `NODE_ENV=production` (build). Do not add env vars without a decision. The repository's `.noesis/settings.json` names its `parser` by language (`{ "language": "csharp" }` or `{ "language": "java", "command": [...] }`).
