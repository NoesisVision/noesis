# Migration Plan: NestJS → Hono, Vite → Bun fullstack

**Status:** done (2026-07-06, decision 28)
**Goal:** Replace NestJS with Hono on `Bun.serve` in `apps/server` and replace
Vite with Bun's fullstack dev server + `Bun.build` in `apps/ui`, following the
wiring of the `first-app` reference project (`~/IdeaProjects/learn-js/first-app`):
explicit composition-root DI, two Bun processes in dev (UI dev server proxies to
the API), static UI build served by path in prod, and a typed `hc` RPC client
for the UI. `apps/local` is out of scope (stays as-is, keeps calling `/api/*`
via route constants).

## Guiding facts

- The server uses almost none of Nest's machinery: 3 controllers with one `@Get`
  each, no guards/pipes/interceptors/websockets. DI wires 6 providers. All of it
  is replaceable by factory functions and one composition root.
- Nest is the only reason for `@nestjs/*` (7 packages), `rxjs`,
  `reflect-metadata`, Express, `supertest`, and 6 of the 7 `--external` build
  flags. After migration the only external is `lbug` (native module,
  decision 24).
- The UI is a plain React 19 SPA (no SSR planned). Bun's fullstack dev server
  covers dev (HMR) and `Bun.build` covers the static prod build; Tailwind (when
  adopted) has an official Bun plugin.
- The Docker image's minimal-lbug staging (decision 24) requires shipping a
  server _bundle_, so the server keeps its `bun build` step — unlike first-app,
  which runs from source but has no native-module constraint. The runtime stage
  of the Dockerfile is unchanged.
- The dependency graph stays acyclic: server never imports UI files (prod
  serving is by path via `UI_DIST_PATH`, as today); the UI gains a _type-only_
  devDependency on server for the `hc` client.

## Target architecture

```
apps/server/src/
  main.ts                 composition root: config → db init → schema → services
                          → createApp(deps) → static UI (prod) → Bun.serve
                          → SIGTERM/SIGINT graceful close (lbug must close cleanly)
  app.ts                  createApp(deps): new Hono().route('/ui', …)
                          .route('/api', …).route('/internal', …)  (chain unbroken
                          so the route tree stays inferable)
  client.ts               `export type AppType` ONLY — the UI's import surface;
                          no value exports, so UI code can never pull server
                          code into the browser bundle
  ui/ui.routes.ts         createUiApp(deps)       (was ui.controller + module)
  api/api.routes.ts       createApiApp(deps)      (was api.controller + module)
  internal/internal.routes.ts  createInternalApp() (was internal.controller + module)
  config/config.ts        loadServerConfig() kept as-is; @Global module deleted
  database/database.service.ts  plain class; onModuleInit/onModuleDestroy →
                          init()/close(), called explicitly from main.ts
  schema/schema.service.ts       plain class; ensureSchema() called from main.ts
  greeting/, projects/    plain classes, decorators dropped

apps/ui/
  src/index.html          moved from app root; <script src="./main.tsx">
  src/dev-server.ts       dev only: Bun.serve({ routes: { '/ui/*': proxy→:3000,
                          '/*': index }, development: { hmr: true } })
  build.ts                prod: Bun.build({ entrypoints: [src/index.html],
                          target: 'browser', minify, sourcemap: 'linked' }) → dist/
  src/client.ts           hc<AppType>(origin) — the one place importing
                          `server/client` (type-only)
```

Dev stays two processes (as with Vite), both Bun, started by the existing root
`dev:server` script: server on `:3000`, UI dev server on `:5173` proxying
`/ui/*`. Prod stays one process: server serves `UI_DIST_PATH` with SPA fallback.

## Inventory

| Area            | File(s)                                                                        | Action                                                                                           |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| server entry    | `src/main.ts`, `src/app.module.ts`                                             | rewrite as `main.ts` + `app.ts` + `client.ts`; delete all 8 `*.module.ts`                        |
| server routes   | `ui/api/internal` controllers (+2 specs)                                       | rewrite as route factories + `app.request()` specs                                               |
| server services | `database`, `schema`, `greeting`, `projects`, `config`                         | drop decorators/Nest `Logger`; explicit lifecycle; logic unchanged                               |
| server tests    | `test/app.e2e.spec.ts`, `test/static-ui.e2e.spec.ts`, `src/testing/test-db.ts` | supertest/TestingModule → `app.request()`; drop `reflect-metadata` import                        |
| server manifest | `apps/server/package.json`                                                     | deps swap (below); build script: single `--external lbug`                                        |
| ui build        | `vite.config.ts`, `index.html`                                                 | delete config; move `index.html` → `src/`, add `build.ts` + `src/dev-server.ts` + `bun-env.d.ts` |
| ui client       | `src/App.tsx`                                                                  | `fetch(uiPath('hello'))` → typed `hc` call                                                       |
| ui manifest     | `apps/ui/package.json`, `tsconfig.json`                                        | drop vite deps; add type-only `server` devDep; `tsc -b` → `tsc --noEmit`                         |
| docker          | `apps/server/Dockerfile`                                                       | build stage: comments only; runtime stage: unchanged                                             |
| docs            | `README.md`, `docs/decisions.md`                                               | tech table; add decision 28 (supersedes parts of 17)                                             |

Unchanged: `apps/local`, all `packages/*`, `railway.json` (healthcheck
`/internal/health` survives), `.github/workflows/ci.yml`, `.githooks`, root
`package.json` scripts.

## Step 1 — Server: composition root and route factories

- `app.ts` exports `createApp(deps: AppDeps)` with the full chained route tree
  and `createProdApp()` for prod wiring. Route factories take a narrow deps
  interface (`{ greetingService }` etc.) — first-app's per-module allow-list
  pattern.
- `main.ts` owns the lifecycle Nest managed implicitly:
  1. `loadServerConfig()` (fail-fast zod parse, unchanged)
  2. `new DatabaseService(dataDir)`; `db.init()`
  3. `new SchemaService(db).ensureSchema()`
  4. construct services, `createApp(deps)`
  5. if `UI_DIST_PATH`: mount `serveStatic({ root })` + SPA fallback (Step 2)
  6. `Bun.serve({ port: PORT ?? 3000, fetch: app.fetch })`
  7. `SIGTERM`/`SIGINT` handler: `server.stop()` then `await db.close()` —
     explicit because lbug segfaults on GC-finalized handles (decision 23);
     Nest's `enableShutdownHooks` equivalent is now our job.
- Nest `Logger` → `console.log`/`console.error` with a `[name]` prefix (5 call
  sites; not worth a dependency).

## Step 2 — Static UI serving parity

Replicate `ServeStaticModule`'s behavior with `hono/bun`'s `serveStatic`:

- `app.use('*', serveStatic({ root: uiDistPath }))` — misses call `next()`, so
  API routes still resolve.
- SPA fallback `app.get('*', …index.html…)` must **exclude** `/ui`, `/api`,
  `/internal` prefixes (guard in the handler) so surface 404s stay JSON/404 and
  are not swallowed by `index.html` — the exact behavior
  `test/static-ui.e2e.spec.ts` pins today; that spec is the parity check.
- Root `/` with no `UI_DIST_PATH` stays 404 (asserted in `app.e2e.spec.ts`).

## Step 3 — Server tests

- e2e specs: `Test.createTestingModule` + `supertest` →
  `createApp(testDeps).request('/ui/hello')`. The shared in-memory DB fixture
  (`test-db.ts`) survives as-is minus the `reflect-metadata` import — the
  one-DB-per-process constraint (decision 23) is unchanged.
- Controller specs become route-factory specs via `app.request()`; service
  specs lose only decorator imports.
- Delete `supertest`, `@types/supertest`; nothing replaces them.

## Step 4 — Server manifest

Remove: `@nestjs/{common,core,platform-express,serve-static,cli,schematics,testing}`,
`rxjs`, `reflect-metadata`, `supertest`, `@types/supertest`, `@types/express`.
Add: `hono` (^4.12), `@hono/zod-validator` (validation arrives with the first
POST route; zod is already a dependency).

Build script becomes:

```
bun build src/main.ts --outdir dist --target bun --external lbug
```

## Step 5 — UI: Bun dev server + build

- `src/dev-server.ts` (dev only): proxies `/ui/*` to `http://localhost:3000`
  (same list as today's Vite proxy — extend when the UI calls more surfaces),
  serves `src/index.html` for everything else, `development: { hmr: true,
console: true }`. Script: `"dev": "bun --hot src/dev-server.ts"`.
- `build.ts`: `Bun.build` with the HTML entrypoint, `target: 'browser'`,
  `minify`, `sourcemap: 'linked'`, `define NODE_ENV=production`, out to `dist/`
  (same output dir the Dockerfile copies). Script: `"build": "bun run build.ts"`.
- `bun-env.d.ts`: `declare module '*.html'` (+ asset modules) so `tsc` accepts
  the HTML import; `check-types` becomes plain `tsc --noEmit` (drop `tsc -b`
  project references — they were Vite-template scaffolding).
- Remove `vite`, `@vitejs/plugin-react`; existing asset imports (`.png`,
  `.svg`, `.css`) are handled by Bun's bundler as-is.
- **Tailwind (planned, not part of this chore):** when adopted, add
  `bun-plugin-tailwind` to `build.ts` `plugins` and to `apps/ui/bunfig.toml`
  (`[serve.static] plugins`) for the dev server. No other changes.

## Step 6 — Typed RPC client (`hc`)

- `apps/server/src/client.ts`: `export type AppType = ReturnType<typeof createApp>`
  — type-only file, exposed via an `exports` entry (`"./client"`). Deliberately
  _not_ the package root, so a value import of server internals from the UI is
  impossible by construction (first-app exports `app.ts` itself, which
  instantiates prod services at module top level — a browser-bundle trap we
  avoid).
- `apps/ui/package.json`: `"server": "workspace:*"` as **devDependency**;
  `src/client.ts` does `import type { AppType } from 'server/client'` and
  exports `hc<AppType>(window.location.origin)`.
- `App.tsx`: `client.ui.hello.$get()` replaces `fetch(uiPath('hello'))` —
  path, method, and response type now compile-time-checked against the server.
- Guardrails (also recorded in decision 28): UI may import only _types_ from
  server (Biome's `useImportType` is already active via the recommended set);
  if Hono type inference ever slows `tsc`, the escape hatch is precompiling the
  server's `.d.ts`.

## Step 7 — Dockerfile, docs, verify

- Dockerfile: build stage commands already run each app's `build` script —
  only comments change ("NestJS" → "Hono"). Runtime stage untouched
  (`UI_DIST_PATH=/app/ui`, minimal lbug staging, `server/main.js`).
- `README.md`: tech table rows for NestJS and Vite.
- `docs/decisions.md`: **Decision 28** — Hono replaces NestJS; Bun replaces
  Vite; first-app wiring (two dev processes, static-by-path prod, acyclic
  deps, type-only `hc` client); portability rules keeping the Vite exit open:
  no `bun:` imports / Bun APIs / Bun import attributes in `apps/ui/src` except
  `dev-server.ts`, HTML import confined to `dev-server.ts` + `build.ts`,
  client-visible env only via `BUN_PUBLIC_*` behind one module. Supersedes the
  "Nest serves the UI" wording of decision 17 (single-service hosting itself
  stands) and the Nest-specific externals list of decision 24.
- Verify: `bun run ci` green; `docker build -f apps/server/Dockerfile .`;
  manual pass — `bun run dev:server`, UI HMR works, `/ui/hello` through the
  typed client, `/internal/health` 200, SPA fallback + surface-404 parity via
  the static-ui e2e spec.

## Decision forks

- **Server prod artifact — chosen: keep bundling** (`bun build`, one external).
  Running from source (first-app style) would require shipping workspace
  `node_modules`, defeating decision 24's 500 MB → 17 MB lbug staging.
- **Route constants vs `hc` — chosen: `hc` for the UI surface.**
  `@repo/ui-contracts`' `uiRoutes`/`uiPath` lose their consumer; retiring the
  package (its DTO barrel just re-exports `@repo/shared-contracts`) is a
  follow-up chore, not blocked on. `@repo/local-contracts` stays — `apps/local`
  is out of scope and keeps calling `/api/*` by constant.
- **UI dev port — chosen: 5173** (Vite muscle memory, no tooling assumes it).
- **UI dev entry — chosen: `dev-server.ts` script.** Rejected alternative:
  CLI-only `bun ./src/index.html` — Bun's HTML dev server has no proxy option
  (its whole `[serve.static]` config is `env` + `plugins`; the docs point to
  `Bun.serve` `routes` for backends), so CLI-only would force the UI to call
  the API cross-origin in dev (`BUN_PUBLIC_API_URL` + CORS middleware on the
  server, dev-only). That trades a ~20-line never-changing script for a
  permanent dev/prod origin split that starts costing when auth lands
  (cookie `credentials`, `SameSite`, CORS allow-lists exercised only in dev).
  Vite hid the same proxy in config; Bun makes it a script.

## What we lose

- **Nest's convention rails** (guards/interceptors/DI for a larger team).
  Accepted: future auth/SSE/websockets map to Hono middleware and Bun-native
  websockets; structure is preserved by the composition-root pattern.
- **Vite's plugin ecosystem and battle-tested prod bundling.** Accepted with an
  exit hatch: the portability rules keep the UI a standard React tree, so
  reverting is swapping `dev-server.ts`/`build.ts` for a `vite.config.ts`.
- **supertest's fluent assertions** — `app.request()` + `expect()` covers it.

## Risks

- Bun fullstack dev server is younger than Vite (HMR edge cases, no
  `transformIndexHtml` equivalent). Mitigated: dev-only exposure; prod is a
  plain static `Bun.build`, not the AOT-fullstack path with open upstream
  issues.
- SPA-fallback/404 parity is the subtle bit — `static-ui.e2e.spec.ts` is the
  gate; port it first so the Hono wiring is written against failing tests.

## Scope

~25 files touched in `apps/server` + `apps/ui`; no behavior changes to routes,
config, DB lifecycle, Docker runtime stage, CI, or `apps/local`.

## Execution notes (deviations found while doing it)

- **`@hono/zod-validator` was not added** — no validated route exists yet;
  it arrives with the first POST route instead of sitting unused.
- **`"type": "module"` on `server`** (needed for top-level await) made
  NodeNext enforce explicit `.js` extensions — spec imports updated to the
  convention src files already used (this is also why extensionless spec
  imports type-checked before: the package was CJS).
- **`serveStatic` gotcha:** absolute paths are honored in `root` but a leading
  `/` in `path` is silently stripped (cwd-relative). The SPA fallback uses
  `{ root: <abs>, path: 'index.html' }`. Caught by `static-ui.e2e.spec.ts`,
  exactly as planned.
- **favicon.svg moved `public/` → `src/`** and is now referenced relatively:
  bun's HTML loader tries to bundle every `<link href>` and has no public-dir
  convention for `/`-absolute URLs. `public/` keeps only `icons.svg` (runtime
  URL references, invisible to the bundler; copied by `build.ts`, served by
  path in `dev-server.ts`).
- **Biome:** `useImportType`/`noExplicitAny` relaxations were rescoped from
  `apps/server`+`apps/local` to `apps/local` only — import-type hygiene on the
  server is part of this decision's guardrails. `apps/ui/src/favicon.svg`
  excluded from linting (asset, not code).
- **Server tsconfig** now extends `base.json` directly; the decision-7
  decorator duplication is gone with the decorators. `nest.json` stays for
  `apps/local`.
