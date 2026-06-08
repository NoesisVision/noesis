# noesis

A [Turborepo](https://turborepo.dev/) monorepo containing the Noesis apps, their shared contract packages, and AI-harness plugins (Claude Code today; Codex, OpenCode, pi planned).

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
- **`servers/noesis-local.js`** — self-contained 3.6 MB bundle of `apps/local`'s MCP entry (committed, so the plugin works without the monorepo's node_modules)
- **`bin/validate.ts`** — simple script that validates any JSON against a named contract using the real zod schemas in **`contracts/`** (readable copies of `@repo/mcp-contracts`, **generated** by `bun run generate`; zod is a regular plugin dependency)
- **`.mcp.json`** — launches the bundled server; target server is configurable via `NOESIS_SERVER_URL` (default `http://localhost:3000`)

The plugin is distributed as the npm package **`@noesis/claude-code-plugin`** (only `.claude-plugin/plugin.json`, `.mcp.json`, `bin`, `contracts`, `servers`, and `skills` ship — see the `files` field). The marketplace catalog lives at `plugins/claude-code/.claude-plugin/marketplace.json` and is added by direct URL, so users never clone this monorepo.

### Config packages

- `@repo/typescript-config` — shared tsconfig presets: `base.json`, `nest.json`, `vite.json`
- `@repo/eslint-config` — shared ESLint flat configs: `base`, `nest`, `vite-react`

> ⚠️ bun's transpiler does not resolve package-specifier `extends` in tsconfig — the Nest apps duplicate `experimentalDecorators`/`emitDecoratorMetadata` inline. Don't remove those.

Shared tool versions (`typescript`, `eslint`, `prettier`, `@types/node`) are pinned once in the root `package.json` **catalog** — workspaces reference them as `"catalog:"`. Internal packages depend on each other via the `workspace:*` protocol.

### Scanners (`scanners/`)

Planned language scanners (`java/`, `dotnet/`) — not yet implemented and not part of the bun workspace.

## 2. Tools

| Tool                                                                                | Role                                                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [bun](https://bun.sh/)                                                              | Package manager, TS runtime (Nest apps run TS directly), bundler, test runner |
| [Turborepo](https://turborepo.dev/)                                                 | Task orchestration + caching (`build`, `lint`, `check-types`, `generate`)     |
| [TypeScript](https://www.typescriptlang.org/)                                       | Everything is TS; internal packages export `src/*.ts` directly                |
| [zod](https://zod.dev/) (v4)                                                        | Contract schemas, env validation, JSON Schema generation                      |
| [NestJS](https://nestjs.com/) 11                                                    | `server` and `local` apps                                                     |
| [React](https://react.dev/) 19 + [Vite](https://vite.dev/)                          | `ui` app                                                                      |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server in `apps/local`                                                    |
| ESLint 9/10 + Prettier                                                              | Linting and formatting                                                        |
| GitHub Actions                                                                      | CI: verifies generated plugin artifacts are committed                         |

## 3. Getting started

### Prerequisites

- [bun](https://bun.sh/) ≥ 1.3 (pinned via `packageManager` in `package.json`)

### Setup & daily workflow

```sh
bun install            # install all workspaces

bun run dev            # run all apps in watch mode (turbo TUI)
bun run dev:server     # just server + ui

bun run build          # build everything
bun run lint           # lint everything (check only; `lint:fix` in each app to autofix)
bun run check-types    # tsc --noEmit across packages
bun run test           # unit tests
bun run test:e2e       # e2e tests
bun run format         # prettier --write (`format:check` to verify)
```

Filter to one package with turbo: `bun x turbo build --filter=server`.

### Working with contracts

1. Add/edit a zod schema in the right package (`shared-`, `ui-`, `local-`, or `mcp-contracts`).
2. For MCP payloads, register it in `packages/mcp-contracts/src/registry.ts`.
3. Regenerate plugin artifacts:

```sh
bun run generate       # refreshes skill schemas/examples + re-bundles the MCP server
```

4. **Commit the generated output** — CI (`.github/workflows/ci.yml`) regenerates and fails on any diff.

### Using the Claude Code plugin

The plugin installs from npm — no monorepo clone needed. Add the marketplace by direct URL:

```sh
# in Claude Code:
/plugin marketplace add https://raw.githubusercontent.com/<owner>/noesis/main/plugins/claude-code/.claude-plugin/marketplace.json
/plugin install noesis@noesis
```

> Note: the catalog references the **published npm package**, so installs track releases, not `main`. When developing the plugin itself, point a local marketplace entry at the folder instead (`"source": "./"`).

Releasing a new plugin version (from `plugins/claude-code`):

```sh
bun run bump 0.2.0     # syncs version across package.json, plugin.json, marketplace.json
bun publish            # prepublishOnly regenerates artifacts automatically
```

> Publish with **bun**, not npm — bun rewrites the `workspace:*`/`catalog:` versions in the packed manifest; npm would publish them verbatim.

Point the MCP server at a different backend per project via `.claude/settings.local.json`:

```json
{ "env": { "NOESIS_SERVER_URL": "https://staging.noesis.dev" } }
```

Validate a hand-written payload against a contract (works in-repo and in installed copies):

```sh
bun plugins/claude-code/bin/validate.ts hello-request path/to/payload.json
```
