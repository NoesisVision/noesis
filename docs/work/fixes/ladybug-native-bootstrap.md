---
type: fix
scope: backend
status: elicited
created: 2026-09-12
---

# Make the LadybugDB native bootstrap safe, and retire it upstream

## Context

The migration's R3 (decision 68) ships the service as `@noesis-vision/noesis`,
launched by the plugin's `.mcp.json` via `bunx`. That surfaced a packaging gap
in `@ladybugdb/core`: the package ships its native binary in a per-platform
optional package (`@ladybugdb/core-<platform>-<arch>`) and copies it into its
own directory from an `install` lifecycle script. bun runs a dependency's
lifecycle scripts only when the root project lists it in
`trustedDependencies`, and a `bunx` install has no root project, so the copy
never happens and the first `require('@ladybugdb/core')` fails on a missing
`lbugjs.node`.

The workaround that landed with R3, verified on 2026-09-12:

- `server/backend/src/native/ensure-ladybug.ts` does the postinstall's job at
  boot: resolves `@ladybugdb/core`, checks for `lbugjs.node` beside its
  `package.json`, and if missing copies it from the platform package with
  `copyFileSync`. It throws a custom error when the platform package is not
  installed.
- `DatabaseService` imports `@ladybugdb/core` lazily in `init()`, because a
  static import would `dlopen` the binary before the copy.
- `main.ts` calls `ensureLadybugBinary()` before `new DatabaseService()`.
- `trustedDependencies: ["@ladybugdb/core"]` stays in `server/backend/
package.json` for the monorepo install, where the postinstall does run.
- `bun build` keeps `@ladybugdb/core` external, so the loader in
  `node_modules` is the one that runs.

The root cause is in Ladybug's loader, `lbug_native.js`: it hardcodes
`join(__dirname, "lbugjs.node")` and has no runtime fallback to the platform
package. esbuild, swc, biome and every napi-rs-generated loader resolve
`@pkg/core-<platform>-<arch>` at require time instead, with no lifecycle script
at all.

Two versions of `@ladybugdb/core` are installed in the workspace right now
(0.18.0 and 0.19.1); the lockfile resolves 0.19.1 for the backend, so 0.18.0
is a stale entry, but `ensure-ladybug.ts` resolves whichever `createRequire`
finds first.

## Problem / Goal

The workaround is correct on the happy path and fragile everywhere else:

- **Concurrent sessions race.** Two agent sessions started at once both see
  the binary missing and both `copyFileSync` to the same target. The second
  copy can overwrite the file while the first process is `dlopen`ing it. The
  atomic pattern the file repositories already use (write to a sibling temp
  name, rename) is what this needs.
- **Unwritable `node_modules` is a raw `EACCES`.** A read-only or shared bunx
  cache fails with the bare `copyFileSync` error instead of a message that
  names the directory and the manual way out.
- **The coupling to Ladybug's internals is unchecked.** The file name
  `lbugjs.node`, the platform package naming scheme and the version pairing
  between core and platform package are all assumed. A Ladybug release that
  renames any of them breaks every new session at boot, not at install.
- **It is untestable as written.** The function resolves real packages, so no
  spec exercises the copy, the race or the error paths.

The goal is a boot-time bootstrap that is atomic, testable and loud when it
cannot help, with a recorded exit condition: the day `@ladybugdb/core` resolves
its binary at runtime, the bootstrap and the lazy import both go.

## Requirements

### Now: harden the bootstrap

- Copy to a sibling temp name (`lbugjs.node.<pid>.tmp`) in the same directory,
  then `renameSync` over the target. Two racing sessions both succeed with
  identical bytes.
- Catch `EACCES` and `EROFS` and rethrow with a message that names the
  directory and the manual fallback (`bun pm trust @ladybugdb/core` in a
  project install, or a writable bunx cache).
- Assert that the platform package's version equals the core package's version
  before copying; fail with both versions in the message.
- Take the resolver (core directory and platform package directory) as a
  parameter with a default, so a spec can point it at a temp fake module tree
  and cover: copy when missing, no-op when present, concurrent copies, missing
  platform package, version mismatch, unwritable directory.
- Log the copy to stderr as today; stdout is the MCP stream.
- Run `bun install` and confirm the stale `@ladybugdb/core@0.18.0` leaves the
  workspace; if something still pulls it, record what.

### Next: fix upstream, then delete

- Open a pull request against LadybugDB's `lbug_native.js`: when
  `join(__dirname, "lbugjs.node")` does not exist, `require.resolve` the
  platform package's `lbugjs.node` and `dlopen` that. Same pattern as
  `@esbuild/*` and napi-rs. The `install` script can stay for the
  build-from-source path.
- Once a release with that fallback is the pinned version: delete
  `native/ensure-ladybug.ts` and its spec, make the `@ladybugdb/core` import
  in `DatabaseService` static again, drop the call from `main.ts`, and drop
  `trustedDependencies` if nothing else needs it.

## Constraints

- `bun run ci` green on every pull request.
- No change to how the monorepo installs; `trustedDependencies` stays until
  the upstream fix is in.
- The `DatabaseService` public API is unchanged; only the import timing moves.

## Non-goals

- Switching the launcher from `bunx` to `npx`. It would run the postinstall,
  but it adds node to the toolchain the user needs, and Ladybug's `install.js`
  falls back to a full C++ build when the platform package is missing.
- Bundling Ladybug's JS loader into `dist/main.js` and patching its path. It
  breaks on every Ladybug release.
- Compiling the service to per-platform single executables.

## Open questions

- Whether LadybugDB's maintainers accept the loader fallback, and on what
  release train. Until known, the "next" section has no date.

## Solution options

_Empty by design; the requirements above are the chosen shape (atomic copy now,
runtime fallback upstream), recorded as a decision when the hardening lands._
