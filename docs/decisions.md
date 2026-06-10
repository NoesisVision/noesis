# Architecture Decision Log

Decisions made while shaping this monorepo, in chronological order. Format: context → decision → rationale/consequences.

_Last updated: 2026-06-10_

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

## 14. De-bundled validator; npm scope; beta release channel

**Supersedes parts of 12/13.**

**Decision:**

- The payload validator is no longer bundled. `scripts/validate.ts` + `scripts/bundle-validator.ts` are gone; instead `bin/validate.ts` ships as plain TS and imports readable zod copies under `contracts/`, generated by `scripts/copy-contracts.ts` (rewrites the `@repo/shared-contracts` specifier to a relative path). `zod` is now a regular plugin `dependency`. SKILL.md calls `bun "${CLAUDE_PLUGIN_ROOT}/bin/validate.ts"`. The `servers/noesis-local.js` MCP server **stays bundled** (NestJS is too heavy to vendor as source).
- `files` whitelist now ships `.claude-plugin/plugin.json`, `.mcp.json`, `bin`, `contracts`, `servers`, `skills`. CI's tarball check asserts `bin/validate.ts`, `contracts/registry.ts`, `contracts/shared/index.ts`.
- Published scope is **`@noesis-vision/claude-code-plugin`** (the `@noesis` scope from 12 was unavailable). Releases go through `bun publish`, not `npm publish` — only bun rewrites `workspace:*`/`catalog:` in the packed manifest.
- A **beta channel** exists: `bun run publish:beta` publishes prerelease versions under the npm `beta` dist-tag, leaving `latest` untouched. The marketplace exposes it as a second plugin entry `noesis-beta` (npm source pinned to `version: "beta"`), so only opt-in testers receive prereleases.

**Consequences:**

- The committed `bin/validate.js` blob (~540 kB) is replaced by small readable TS; drift surface shrinks but is still CI-guarded.
- `tsconfig.json` `include` widened to `["scripts", "bin", "contracts"]` so the shipped entry point and generated copies are type-checked.

## 15. Tag-driven releases via npm trusted publishing; bundle built at pack time; version single-sourced

**Supersedes the release flow of 14 and the committed-bundle parts of 9/11.**

**Decision:**

- **Releases are tag-driven.** Pushing a `v*` tag runs `.github/workflows/release.yml`: full verify suite (tags don't trigger CI), generate-drift check, tag↔version assertion, then `bun run bundle` + `bun pm pack` (bun rewrites `workspace:*`/`catalog:`) and `npm publish <tarball>` via **npm trusted publishing** (OIDC, npm ≥ 11.5.1) — no token secret, provenance attached automatically. `bun publish` can't do this yet (oven-sh/bun#15601). The dist-tag is derived from the version: prerelease (`-` present) → `beta`, otherwise `latest` — removing the manual `publish:beta` footgun (the script remains as a local escape hatch). Prerequisites added: `license: MIT` (+ LICENSE file), `repository` with `directory` (provenance validation requires it), README (npm page was blank). _One-time setup: configure the trusted publisher on npmjs.com for `@noesis-vision/claude-code-plugin` → this repo + `release.yml`._
- **`servers/noesis-local.js` is no longer committed** (gitignored). Since npm is the only distribution channel (12), committing it only grew git history ~3.6 MB per regeneration with unreviewable diffs. It's built by `bun run bundle` — split out of `generate` — at pack time (`prepublishOnly`, release workflow) and by the tarball smoke test. The small readable generated artifacts (`contracts/`, skill references) stay committed and drift-checked.
- **`package.json` is the single version source.** `generate` stamps `.claude-plugin/plugin.json` from it (`scripts/stamp-plugin-version.ts`), so the CI drift check now also enforces version sync. `bun run bump` writes only `package.json` + the stable marketplace pin.
- **Smoke tests replace the CI tarball grep.** `bun test` (runs under `turbo test`): every contract's committed `example.json` must pass `bin/validate.ts`; the real tarball is packed and extracted, file whitelist and `workspace:`/`catalog:`-free manifest asserted, and the bundled MCP server is booted from the extracted tarball in an empty directory for an MCP initialize + `tools/list` handshake — decision 9's "boots from an empty dir" property is now verified on every CI run.

**Consequences:**

- Release flow: `bun run bump <ver>` → `bun run generate` → commit → `git tag v<ver>` → push tag. Each release has an anchor commit.
- A plain checkout no longer has a working MCP server bundle — run `bun run bundle` once (or `bun test`, which builds it).
- Known wart: npm's `latest` dist-tag currently points at `0.1.0-beta.1` (first publish always claims `latest`; it can only be moved, not removed). The first stable release fixes it.

## 16. Plugin folders follow documented Claude Code semantics; beta channel pinned to semver

**Supersedes the `bin/` location of 14 and the beta dist-tag pin of 14.** Triggered by checking the layout against the official plugin reference.

**Context:** The plugin docs assign meanings to folder names: `scripts/` = shipped hook/utility scripts invoked via `${CLAUDE_PLUGIN_ROOT}/scripts/...`; `bin/` = executables added to the Bash tool's PATH (invokable as bare commands while the plugin is enabled). Our `scripts/` held unshipped dev/build tooling, and `bin/validate.ts` sat in the PATH folder without using (or being usable by) its semantics. Separately, the marketplace npm source only documents exact-semver pins (`2.1.0`, `^2.0.0`) — the `noesis-beta` entry's `"version": "beta"` dist-tag pin relied on undocumented behavior.

**Decision:**

- Dev/build tooling moved `scripts/` → `tools/` (the standard JS-ecosystem alternative; stays unshipped). The validator moved `bin/validate.ts` → `scripts/validate.ts`, matching the docs' shipped-utility-script convention; `bin/` is gone. The MCP server bundle deliberately **stays** in `servers/` — the docs' own example location — and must not move to `bin/`: PATH exposure would let the model accidentally launch a long-running stdio server in a Bash call. `files` ships `scripts` instead of `bin`; the tarball test asserts `tools/` and `test/` do not leak into the package.
- `plugin.json` gained the recommended metadata fields (`author`, `homepage`, `repository`, `license`).
- The `noesis-beta` marketplace entry is pinned to an exact prerelease version. `bun run bump` advances the channel matching the bumped version's prerelease-ness: prerelease bumps advance prerelease-pinned entries, stable bumps advance stable-pinned ones. Testers get updates when the bumped `marketplace.json` lands on `main` (the catalog is fetched by raw URL), so nothing is lost versus the dist-tag pointer — except the reliance on undocumented behavior.

**Consequence:** A bare-command validator (`bin/noesis-validate` with shebang + exec bit on the Bash PATH) was considered and skipped — the validator is only invoked from SKILL.md, where an explicit `bun "${CLAUDE_PLUGIN_ROOT}/scripts/validate.ts"` is clearer.

## 17. Hosting: single Railway service; Nest serves the UI

**Status: implemented (see 18 for the route surfaces and implementation deltas).**

**Context:** `apps/server` (NestJS on bun) and `apps/ui` (Vite SPA) need hosting on a single platform. Options considered: Vercel (UI fits perfectly, but its serverless functions don't support NestJS — the bun runtime is beta and framework-limited — and the server's main consumers are MCP servers on developer machines hitting `NOESIS_SERVER_URL`, which want an always-on REST target); a Vercel-UI + Railway-server split (rejected: two platforms); Render (always-on tier costs more for the same); Fly.io (more hand-rolled ops). A serverless backend was explicitly evaluated and rejected: the planned **in-memory LadybugDB graph** (embedded, in-process, native bindings) is architecturally opposed to serverless — ephemeral instances lose the graph, horizontal fan-out diverges it, and native addons fight function packaging. An embedded in-memory database means the database _is_ the process, so the process must be long-running.

**Decision:** Deploy on **Railway** as **one service**: the NestJS server serves the built UI statically (`@nestjs/serve-static`, serving `apps/ui/dist` staged into the server's deploy). One URL, one deploy, no CORS; "serverless economics" available later via Railway app sleeping if idle cost matters.

**Consequences:**

- UI and server deploy together (acceptable at this stage); static assets are served by the app process, not a CDN.
- Splitting into two Railway services later (independent deploys/scaling) is a small change — only the serving location of `apps/ui/dist` moves; the apps stay separate in the repo either way.
- When LadybugDB lands: keep a single instance (single writer), persist via a Railway volume (on-disk Ladybug, or in-memory + checkpoint on `OnModuleDestroy` and on an interval, reload on boot).
- Implementation when picked up: `ServeStaticModule` in `apps/server` (path empty in dev), build step staging `apps/ui/dist`, Railway service config, README deploy notes.

## 18. Route surfaces by consumer; Dockerfile deploys via CI `railway up`

**Implements 17, with deltas. Supersedes the single `/api` global prefix (12-era `main.ts`).**

**Context:** Implementing 17 surfaced two things. First, serving the SPA and the REST API from one origin needs route prefixes that can't collide — and different consumers will need different auth. Second, the original `setGlobalPrefix('api')` had silently broken the MCP client, which fetched the server root (404); nothing caught it because no test exercised an MCP `tools/call` end to end.

**Decision:**

- **Routes are segregated by consumer, one Nest module per surface:** `/ui/*` (ui app; future session-style auth), `/api/*` (local app / MCP; future token auth), `/internal/*` (health and technical endpoints; must stay harmless while publicly reachable). Future auth is a per-module guard binding — never global.
- **Route constants live in the contracts packages** (`@repo/ui-contracts` → `uiRoutes`/`uiPath`, `@repo/local-contracts` → `apiRoutes`/`apiPath`); controllers, the ui fetch, and `ServerClientService` import them, so client/server drift is impossible. This fixed the MCP client 404 by construction.
- **SPA serving is opt-in via `UI_DIST_PATH`** (absolute-resolved; set in the container, unset in dev where Vite serves the ui and in tests). The three surfaces are excluded from the index.html fallback so their JSON 404s survive.
- **Deployment:** repo-root multi-stage `Dockerfile` (`oven/bun` pinned to `packageManager`; manifests-first install layer; `turbo build --filter=server --filter=ui`; slim runtime with only the two dist outputs, non-root). `railway.json` sets the Dockerfile builder, `/internal/health` healthcheck, and on-failure restarts. The `deploy` job in `ci.yml` runs `railway up --ci` on green main pushes only (needs `RAILWAY_TOKEN` secret + `RAILWAY_SERVICE` repo variable) — deltas from 17's sketch: Dockerfile instead of builder auto-detect, Actions-driven instead of Railway auto-deploy.
- **New test layers:** a full-stack MCP e2e (boots the server app, drives a real `tools/call` through `apps/local` — the test that would have caught the 404) and a black-box SPA-serving e2e (fixture `UI_DIST_PATH`, asserts fallback and surface 404 behavior).

**Consequences:**

- `@fastify/static` joined the server build externals (lazy-required by `@nestjs/serve-static`; unused on the Express adapter) — the decision 9 externals list grows with each Nest optional dep.
- The route move was breaking for old plugin builds; shipped before any server was deployed, so no consumer broke. A plugin beta release carries the client fix.
- `NOESIS_SERVER_URL` for plugin users is the Railway-generated service domain.

## 19. Java scanner: ArchUnit importer as the engine, Spoon for source fidelity

**Context:** The Java scanner (`scanners/java/`, see `scanners/java/design-doc.md` for the full research) must extract graph objects, behaviours, and relations from Java codebases and ship as both a Maven and a Gradle plugin. Candidates evaluated: ArchUnit's `ClassFileImporter` (bytecode, Apache 2.0, shaded single JAR, `@PublicAPI`-stable, proven standalone by Spring Modulith), jQAssistant (closest off-the-shelf code graph but **GPLv3** — embedding would infect the plugin license — and no official Gradle support), Spoon (source-based JDT metamodel, MIT option, exact positions/comments/parameter names, no-classpath mode, but slower and heavier), and roll-your-own ASM (maximal control, but re-implements what ArchUnit already solved). CodeQL was disqualified on license grounds.

**Decision:** Two-engine design inside `scanner-core`:

- **ArchUnit's importer is the primary engine** — it produces the graph (objects, behaviours, relations) from compiled bytecode.
- **Spoon provides the source-fidelity enrichment pass** — exact source positions, comments/Javadoc, and parameter names, merged into the graph as optional fields keyed by FQN + member descriptor. Spoon is chosen over JavaParser for this role because of its no-classpath mode (best-effort model without resolution failures) and the MIT license option.
- The engines stay invisible above `scanner-core`: the Maven Mojo and Gradle plugin (Worker API, isolated classloader) only gather inputs (class dirs, source roots, classpath) and invoke the core, per the OpenRewrite/SpotBugs three-artifact pattern.

**Rationale:** ArchUnit gives the best effort-to-coverage ratio — its metamodel maps ~1:1 onto the objects/behaviours/relations contract and its fully-shaded JAR avoids classpath conflicts inside build-tool plugins. Bytecode-only analysis loses comments, parameter names, and exact positions; Spoon fills exactly that gap without replacing the structurally complete bytecode graph.

**Consequences:**

- Scan binds after compilation (Maven post-`compile`, Gradle `dependsOn(classes)`); the Spoon pass needs source roots in addition to class dirs.
- The contract schema must model enrichment fields as **optional** (the Spoon pass may be skipped or partial) and must represent unresolved/ambiguous access targets explicitly (ArchUnit targets can resolve to 0..n members).
- Spoon's JDT dependency is unshaded — classloader isolation in the plugins is mandatory, not optional.
- Performance guardrails for large codebases: disable ArchUnit's classpath dependency resolution by default, scan module-by-module, stream JSON output.
- Remaining open questions tracked in design-doc §10: graph schema variant, relation derivation rules, multi-module aggregation, transport (file vs direct POST), Maven/Gradle coordinates.

## 20. Java scanner graph schema: typed DDD graph with messages and behaviour-level invocation

**Context:** The graph's purpose is visualizing system structure as DDD building blocks (tactical patterns plus hexagonal ports/adapters), detected via class annotations in ArchUnit's model (see `scanners/java/design-doc.md` §8–9). Three schema variants were evaluated: (A) generic property graph with open string vocabulary — flexible but contract-unsafe; (B) strongly-typed closed vocabulary as zod discriminated unions — the contract becomes the ubiquitous language; (C) layered architecture-over-code graph — drill-down capable but class-level payload volume on day one.

**Decision:** **Variant B, modified**, with three structural choices on top:

- **All communication is modeled as messages**: `Command`, `Query`, `Event` are first-class message nodes (annotated classes); communication edges (`SENDS`, `HANDLES`) point at messages, never block-to-block. One edge vocabulary for all three kinds — the message node's type distinguishes rendering.
- **Building blocks contain `Behaviour` nodes** (public methods, id = `fqn#method(paramTypes)`); an `ApplicationService` exposes its message handlers as behaviours with `HANDLES` edges. Invariants at ingest: commands and queries have exactly one handler (on an `ApplicationService`), events 0..n.
- **Invocation is behaviour-level**: `INVOKES` edges between behaviours replace block-level `USES`; block-to-block usage is derived server-side by lifting `INVOKES` through `CONTAINS`. Derived edges carry an optional `evidence: string[]` (borrowed from variant C) with source locations.

Full node/edge taxonomy and ArchUnit derivation rules in design-doc §9.4. Stereotype detection defaults to the **jMolecules** vocabulary (Apache-2.0) via a configurable annotation→stereotype mapping; `Query` has no jMolecules annotation and comes from the mapping (team annotation or a small `noesis-annotations` artifact).

**Rationale:** The typed contract rejects invalid graphs at ingest and gives the visualizer bespoke rendering per type without a side registry. Messages + behaviours capture _how the system communicates_ — the part of structure the visualization is for — at behaviour granularity (~5–10× block count), still orders of magnitude below variant C's class-level volume.

**Consequences:**

- Schema evolution is lock-step (zod contract + scanner + server ship together); new stereotypes are contract changes.
- The server owns derived views (block-to-block usage via `INVOKES` lifting) — the scanner ships facts, not aggregations.
- Custom team annotations must map onto the closed set via scanner config or they are dropped.
- Remaining open questions move to design-doc §10: `SENDS` derivation beyond constructor calls, ambiguous access targets in `INVOKES`, multi-module aggregation, transport, coordinates.
