# Architecture Decision Log

Decisions made while shaping this monorepo, in chronological order. Format: context → decision → rationale/consequences.

_Last updated: 2026-06-08_

---

## 1. Shared TypeScript config presets

**Context:** `ui`, `server`, and `local` each carried standalone tsconfigs; only `web-contracts` used `@repo/typescript-config`.

**Decision:** Add `nest.json` and `vite.json` presets to `@repo/typescript-config` (mirroring `eslint-config`'s `nest.js` / `vite-react.js` split) and reduce app tsconfigs to deltas only (`outDir`, `baseUrl`, lib/types/jsx).

**Rationale:** One source of truth per app type. Behavior was preserved exactly — the Nest apps keep their NestJS-default looseness (`strict: false` + `strictNullChecks`) rather than inheriting `base.json`'s full strictness, so the migration could not break builds. Tightening later is a separate, deliberate step.

## 2. Remove create-turbo leftovers

**Decision:** Delete unused presets (`typescript-config/nextjs.json`, `react-library.json`; `eslint-config/next.js`, `react-internal.js`) and the deps only they used (`@next/eslint-plugin-next`, `eslint-plugin-react`). Fix `turbo.json` `build.outputs` from `.next/**` to `dist/**`.

**Rationale:** No Next.js apps remain. Wrong `outputs` meant turbo cached no build artifacts at all ("no output files found" warnings).

## 3. Contracts package naming and split

**Decision:** Rename `web-contracts` → `ui-contracts`. Create `local-contracts` (server↔local DTOs) and later `shared-contracts` (DTOs common to ui/local/mcp). Each pair-specific package re-exports `@repo/shared-contracts`.

**Rationale:** Names follow the consuming app. Contract packages are consumed as TypeScript source (`exports` → `src/*.ts`, no build step) — bun and the bundlers handle TS directly, keeping the packages dependency-light. Apps import their own contracts package and see common DTOs through the re-export, so the shared package stays an internal detail.

## 4. zod as the schema language

**Decision:** All contracts are zod (v4) schemas with inferred TS types (`z.infer`), not plain interfaces. `mcp-contracts` exposes a `contracts` registry (`name → {schema, example}`) plus a `toJsonSchema()` helper.

**Rationale:** One definition feeds three consumers: runtime validation (`safeParse`), JSON Schema generation (`z.toJSONSchema`, draft 2020-12) for model-facing skill references, and static types. Consumers needing only types use type-only imports — zod is erased from their runtime. The registry + helper keep zod itself encapsulated in the contracts package, so future harness plugins (Codex, OpenCode, pi) write generators without depending on zod directly.

## 5. Plugins live in `plugins/`, one folder per harness

**Decision:** Top-level `plugins/` (workspace members) separate from `packages/`. `plugins/claude-code` follows the official Claude Code plugin layout (`.claude-plugin/plugin.json` manifest; `skills/`, `bin/`, `servers/`, `.mcp.json` at plugin root).

**Rationale:** Plugin folders must follow each harness's mandated structure and shouldn't be forced into library conventions. Workspace membership gives plugin scripts full TS access to the contract packages (a future-proofing requirement: validation scripts import the real zod schemas, no duplication).

## 6. Generated skill references are committed

**Decision:** `turbo generate` emits `skills/*/references/*.schema.json` + `*.example.json` from `@repo/mcp-contracts`, and the output is committed (not gitignored).

**Rationale:** Skills are static markdown + JSON read by the model; they cannot import TS. The plugin must be self-contained when installed outside the monorepo — installers don't run our turbo pipeline. Drift is prevented by CI (decision 11).

## 7. ⚠️ bun does not resolve package-specifier tsconfig `extends`

**Context:** After migrating to `"extends": "@repo/typescript-config/nest.json"`, both Nest apps **broke at runtime** — bun's transpiler silently lost `experimentalDecorators`/`emitDecoratorMetadata` and compiled TC39 standard decorators, which Nest DI cannot use. `tsc` resolved the extends fine, so type checks stayed green and the breakage was invisible until boot.

**Decision:** Duplicate the two decorator flags inline in `apps/{server,local}/tsconfig.json`, with a comment explaining why they must not be removed.

**Consequence:** Any new bun-run Nest app needs the same inline flags. Verification lesson: `tsc --noEmit` is not sufficient for tsconfig changes in bun apps — boot the app.

## 8. MCP server lives in `apps/local`, speaks stdio

**Decision:** `apps/local/src/mcp.ts` is a dedicated stdio entry: Nest **application context** (no HTTP listener) + `@modelcontextprotocol/sdk` `StdioServerTransport`. Tool input schemas come straight from `@repo/mcp-contracts` (`schema.shape`). All logging goes to **stderr** via a custom logger.

**Rationale:** Reuses Nest DI/services without the HTTP layer. stdout belongs to the MCP protocol — Nest's default logger writes to stdout and corrupts the stream (observed during testing).

## 9. Plugin runs the MCP server via a committed self-contained bundle (option "D1")

**Context:** Options considered: (A) stdio spawn from monorepo sources (`${CLAUDE_PROJECT_DIR}` — works only in-repo), (B) long-running HTTP server the plugin points at, (C) stdio launcher that ensures the HTTP app, (D) bundling the app into the plugin — as JS bundle (D1), compiled binary (D2, ~60 MB/platform, needs release infra), or sources + first-run install (D3).

**Decision:** D1 — `turbo generate` runs `bun build --target bun` on `mcp.ts` → committed `plugins/claude-code/servers/noesis-local.js` (~3.6 MB). `.mcp.json` launches it with `bun ${CLAUDE_PLUGIN_ROOT}/servers/noesis-local.js`.

**Rationale:** Verified empirically: the bundle boots and serves from an empty directory with no `node_modules` (Nest's optional deps stay `--external`; Nest lazy-requires them in try/catch). Claude Code owns the process lifecycle. Requires bun on the target machine — acceptable, the toolchain is bun-first. Option B (HTTP) remains the natural extension when multiple harnesses should share one running server.

## 10. Server URL is configured via `NOESIS_SERVER_URL`

**Decision:** The MCP server's REST target is `NOESIS_SERVER_URL`, zod-validated at bootstrap (`z.url()`, default `http://localhost:3000`, fail-fast with exit 1 on garbage). `.mcp.json` uses `${NOESIS_SERVER_URL:-http://localhost:3000}` expansion.

**Rationale:** Developers pick the server through existing Claude Code layers — `.claude/settings.json` `env` (team default), `.claude/settings.local.json` (personal), shell env — with zero plugin changes. A runtime-switch tool persisting to `${CLAUDE_PLUGIN_DATA}` was considered and deferred until mid-session switching is a real need.

## 11. CI enforces that generated output is committed

**Decision:** GitHub Actions job: `bun install --frozen-lockfile` → `bun run generate` → fail if `git status --porcelain` is non-empty. Bun version pinned via `bun-version-file: package.json` (`packageManager`).

**Rationale:** The committed bundle/schemas must never drift from `apps/local` / `mcp-contracts` sources. `--porcelain` catches untracked new files, not just modifications. Pinning bun matters because bundle bytes may differ across bun versions (false drift). Determinism was verified (byte-identical output across runs) so the check cannot flap.

## 12. npm distribution; marketplace catalog inside the plugin folder

**Context:** Installing from a git marketplace clones the entire monorepo — unacceptable for plugin consumers. Alternatives: `git-subdir` source (sparse clone), npm publishing, or a mirrored standalone repo.

**Decision:** Publish the plugin as **`@noesis/claude-code-plugin`** (npm `source` in the marketplace). `marketplace.json` moved from the repo root to `plugins/claude-code/.claude-plugin/marketplace.json`; users add it by **direct raw URL**, which fetches one JSON file — no clone at any step.

**Consequences:**

- `files` whitelist ships exactly `.claude-plugin/plugin.json`, `.mcp.json`, `bin`, `servers`, `skills` (~755 kB tarball). Dotfiles must be listed explicitly — npm excludes them by default; CI checks tarball contents (`npm pack --dry-run`) for the critical files and rejects an accidentally-included `marketplace.json`.
- `@repo/mcp-contracts` moved to `devDependencies` — workspace deps don't resolve for npm consumers; the shipped artifacts are self-contained instead.
- `scripts/validate.ts` is bundled at generate time to committed `bin/validate.js` so installed copies can validate payloads (SKILL.md calls `bun "${CLAUDE_PLUGIN_ROOT}/bin/validate.js"`).
- Repo-form `/plugin marketplace add owner/repo` no longer works (nothing at the repo root) — by design; installs track published releases, not `main`.
- Releases require bumping the version in `package.json`, `plugin.json`, and `marketplace.json`, regenerating, and `npm publish`.
- The `@noesis` npm scope is a placeholder until first publish.

## 13. Plugin's model-facing vs. runtime-facing schema split

**Decision (cross-cutting, emerged from 4/6/9/12):** Each contract exists in three synchronized forms — zod source (`packages/mcp-contracts`), generated JSON Schema + example (skill references, for the model to read), and bundled runtime validators/tools (`bin/validate.js`, `servers/noesis-local.js`). `turbo generate` is the single command that synchronizes all of them; CI guards the sync.

**Rationale:** Models read JSON Schema cheaply without executing code; runtime code validates with the real schemas; humans edit exactly one zod definition.
