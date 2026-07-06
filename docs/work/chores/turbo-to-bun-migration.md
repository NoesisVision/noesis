# Migration Plan: Turborepo → Pure Bun Monorepo

**Status:** done (2026-07-06, decision 22)
**Goal:** Remove Turborepo and run the workspace as a pure Bun monorepo, using
`bun run --filter` for task orchestration (the shape used by the `first-app`
reference project).

## Guiding fact

Shared packages ship as **TypeScript source** (`exports: "./src/index.ts"`), so
no workspace consumes another's build artifact:

- Every `@repo/*-contracts` package exports `src/index.ts` directly and has no
  `build` script. Bun runs `.ts` natively, so `server`/`ui`/`local` import
  contract source — nothing must be built first.
- Only the three apps (`server`, `ui`, `local`) have a `build` script, and none
  consume another workspace's `dist`. So turbo's `dependsOn: ["^build"]`
  ordering is never load-bearing for correctness.
- `check-types` / `test` / `lint` each read source independently — order does
  not affect correctness.

Turbo's caching and topological ordering therefore buy almost nothing here.
`bun run --filter` (which skips packages lacking the named script, and in Bun
1.3 runs in workspace-dependency order anyway) is a faithful replacement.

## Turbo touchpoints inventory

| File                                                                            | Turbo coupling                                                                                  | Action                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| `turbo.json`                                                                    | task graph + globalEnv                                                                          | **delete**                  |
| `.turbo/` (cache, preferences)                                                  | local cache                                                                                     | **delete**                  |
| root `package.json`                                                             | `turbo` dep + 8 `turbo run` scripts                                                             | rewrite scripts, drop dep   |
| `packages/eslint-config/base.js` + `pkg.json`                                   | `eslint-plugin-turbo`, `turbo/no-undeclared-env-vars` rule                                      | remove plugin + rule + dep  |
| `packages/eslint-config/README.md`                                              | titled `@turbo/eslint-config`                                                                   | retitle                     |
| `Dockerfile`                                                                    | `COPY … turbo.json`, `bunx turbo build --filter=…`                                              | swap to `bun run --filter`  |
| `.github/workflows/ci.yml`                                                      | `turbo run … --affected`, `TURBO_SCM_BASE` step, `turbo.json` in paths-filter, `fetch-depth: 0` | rewrite verify job          |
| `.gitignore`                                                                    | `.turbo` entry                                                                                  | remove line                 |
| `README.md`                                                                     | 3 Turborepo mentions                                                                            | update                      |
| `docs/decisions.md`                                                             | decision 21 describes turbo `--affected`                                                        | add superseding decision 22 |
| `generate-references.ts`, `prepare-mcp-data/SKILL.md`, `sdlc-migration-plan.md` | `turbo generate` in comments/docs                                                               | text swap                   |

The `globalEnv` vars (`PORT`, `NOESIS_SERVER_URL`, `UI_DIST_PATH`,
`NOESIS_DATA_DIR`) need no new home — apps already read `process.env` directly;
those were only turbo cache-key declarations.

## Step 1 — Root `package.json`

Rewrite scripts:

```jsonc
"build":        "bun run --filter '*' build",
"dev":          "bun run --filter '*' dev",
"dev:server":   "bun run --filter=server --filter=ui dev",
"lint":         "bun run --filter '*' lint",
"test":         "bun run --filter '*' test",
"test:e2e":     "bun run --filter '*' test:e2e",
"check-types":  "bun run --filter '*' check-types",
"generate":     "bun run --filter '*' generate",   // only plugin has it
"format":       "prettier --write \"**/*.{ts,tsx,md}\"",   // unchanged
"format:check": "prettier --check \"**/*.{ts,tsx,md}\"",   // unchanged
"ci":           "bun run lint && bun run check-types && bun run test && bun run test:e2e && bun run build"
```

Drop `"turbo": "^2.9.16"` from `devDependencies`.

## Step 2 — Delete turbo files

- `rm turbo.json`
- `rm -rf .turbo`
- Remove the `# Turbo` / `.turbo` lines from `.gitignore`.

## Step 3 — `packages/eslint-config`

- `base.js`: delete the `{ plugins: { turbo }, rules: { "turbo/no-undeclared-env-vars" } }` block and its `import turboPlugin from "eslint-plugin-turbo"`.
- `package.json`: drop `"eslint-plugin-turbo"`.
- `README.md`: retitle from `@turbo/eslint-config`.

## Step 4 — `Dockerfile`

- Drop `turbo.json` from the manifest `COPY` line.
- Replace `RUN bunx turbo build --filter=server --filter=ui`
  → `RUN bun run --filter=server --filter=ui build`.

## Step 5 — `.github/workflows/ci.yml` (run-all strategy)

- In the `verify` job: delete the "Resolve base for turbo --affected" step and
  `fetch-depth: 0`.
- Replace the five `bunx turbo run … --affected` steps with plain `bun run lint`,
  `bun run check-types`, `bun run test`, `bun run test:e2e`, `bun run build`
  (or a single `bun run ci`).
- Remove `turbo.json` from the `ts` paths-filter list.
- Java job, format job, deploy job, `generate-check` job: unchanged.

## Step 6 — Docs & comments

- `README.md`: update the 3 Turborepo references (intro line, tech table, dev
  command notes → `bun run dev`, `bun run --filter=server build`).
- `generate-references.ts` + `prepare-mcp-data/SKILL.md`: `turbo generate`
  → `bun run generate`.
- `sdlc-migration-plan.md`: update the 3 _forward-looking_ `turbo generate` /
  `turbo test` mentions; leave historical "Verified:" lines as-is.
- `docs/decisions.md`: add **Decision 22** superseding the turbo / `--affected`
  parts of decision 21.

## Step 7 — Lockfile & verify

- `bun install` (regenerates `bun.lock` without turbo).
- Run `bun run ci` locally: lint, check-types, test, test:e2e, build all green.
- Confirm `bun run dev` starts all apps and `docker build .` succeeds.

## Decision fork: CI `--affected` replacement

**Chosen: run-all.** Drop `--affected` / `TURBO_SCM_BASE`; the verify job runs
all TS tasks every push. Job-level Java/TS gating (`dorny/paths-filter`) stays.
Rejected alternative: per-package path filters — preserves selective execution
but reintroduces the path-list maintenance turbo's graph gave for free.

## What we lose

- **Per-package selective CI** (`--affected`) — now runs all TS tasks each push
  (job-level Java/TS gating stays). ~10 small packages, so cost is minor.
- **Turbo local build cache** — rebuilds aren't memoized. Given
  contracts-as-source, real build work is only the 3 apps.

## Scope

~11 files touched, no source-code logic changes.
