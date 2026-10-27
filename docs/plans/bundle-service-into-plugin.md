# Plan: bundle the service into the Claude Code plugin

Today the plugin `@noesis-vision/claude-code-plugin` carries no service code.
Its `.mcp.json` runs `bunx @noesis-vision/noesis@<version>`, so the service is
a second npm package, published first and fetched from npm when a session
starts for the first time. This plan ships the built service inside the plugin
tarball and launches it from `${CLAUDE_PLUGIN_ROOT}`, so one package, one tag
and one publish carry both.

## Why

- **One package instead of two.** The service must be on npm before the plugin
  that pins it, or the plugin installs and its MCP server fails to start. That
  is the state today: `@noesis-vision/noesis` has never been published (npm
  answers 404), because its publish step was added on 2026-09-12, after the
  last tag `v0.1.0-beta.4`.
- **No network at session start.** Claude Code copies an installed plugin into
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. A bundled
  service starts from that copy; `bunx` downloads 4.8 MB on the first session
  and fails offline or behind a registry mirror. This also matches the "No
  network" boundary in `docs/arch/ARCHITECTURE.md`.
- **The documented pattern.** The plugin docs show MCP servers shipped inside
  the plugin (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"]`)
  and say nothing about `bunx` launchers.
- **Nothing blocks it.** The service has no runtime dependencies since
  `cb3b92f2` removed `@ladybugdb/core`; `dist/` is `main.js` plus the vite
  page in `dist/ui/`. Claude Code skips lifecycle scripts when it installs an
  npm-source plugin and needs no lockfile when the plugin has no dependencies,
  so no install step is needed. Scanners run a command configured in the
  user's project, so nothing else has to ship.
- **The release gets simpler.** The plugin already has a trusted publisher on
  npmjs.com, so the manual first publish the service would need disappears.

## Decisions

| Topic                  | Decision                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the service sits | `plugins/claude-code/server/`: `main.js` and `ui/`, copied from `server/backend/dist/` by the plugin's `build` (so also on `prepack`). Gitignored, like `contracts/`                                             |
| Launch                 | `.mcp.json` runs `bun` on a file under `${CLAUDE_PLUGIN_ROOT}/server/`. Bun stays a prerequisite, as today                                                                                                       |
| Dev override           | Keep running the service from source in a checkout. Mechanism decided by the spike in step 0: nested expansion if Claude Code supports it, otherwise a launcher                                                  |
| Service package        | `server/backend` becomes `private: true`; `bin`, `files`, `publishConfig` and `repository` go. It keeps `version`, because `main.ts` bundles it as the MCP server version; `bump` keeps it equal to the plugin's |
| What gets copied       | Only `dist/main.js` and `dist/ui/`, named explicitly, and the backend `build` empties `dist/` first. A local `dist/` today holds four stale `index-*.js` chunks from September that `main.js` never loads        |
| Pin stamping           | Gone. `.mcp.json` no longer names a version, so `stamp-plugin-version.ts` stamps only `.claude-plugin/plugin.json`                                                                                               |
| Release                | One publish: the plugin. The workflow loses the service pack and publish steps and the service-version check; the tag still has to match the plugin version                                                      |
| Tarball tests          | The plugin's `tarball.test.ts` boots the service **from the extracted tarball**, which tests what ships. The backend's `pack.spec.ts` goes; its checks on the bin and the page move to the plugin test           |
| Standalone service     | Not published. If another agent host needs it later, the same `dist/` can be published as a package again                                                                                                        |

## Steps

### 0. Spike: the dev override (done)

The current override is `${NOESIS_SERVICE_ENTRY:-@noesis-vision/noesis@<version>}`.
The bundled default needs a variable inside the default:

```json
"command": "bun",
"args": ["${NOESIS_SERVICE_ENTRY:-${CLAUDE_PLUGIN_ROOT}/server/main.js}"]
```

The Claude Code docs document `${VAR:-default}` and `${CLAUDE_PLUGIN_ROOT}`
in `command`/`args`, but not a variable inside a default. A probe plugin run
with `claude --plugin-dir <probe> mcp list` on Claude Code 2.1.310 showed it
works: unset, it launched `${CLAUDE_PLUGIN_ROOT}/probe.js`; set, it launched
the override. So no launcher ships. `NOESIS_SERVICE_COMMAND` goes, because
`bun` runs both the bundle and the source entry.

If a later Claude Code stops expanding nested defaults, the fallback is a
launcher `server/launch.js` running
`await import(process.env.NOESIS_SERVICE_ENTRY ?? './main.js')`. That works
because `main.ts` has no `import.meta.main` guard and `production` is inlined
at build time.

### 1. Backend build

- `server/backend/package.json` `build`: empty `dist/` before `bun build`.
- Make the package private, as in the table. Leave `prepack` out: nothing
  packs the backend any more.

### 2. Plugin build

- New `tools/build-service.ts`: runs the backend `build`, empties
  `plugins/claude-code/server/` and copies `main.js` and `ui/` into it (plus
  `launch.js` if step 0 needs it). Same shape as `build-contracts.ts`.
- `build`: contracts, then service.
- `files`: add `server`. `.gitignore`: add `/server/`.
- Root `build`: `bun run build:plugin` instead of `--filter '*' build`. The
  plugin build builds the service itself, so building both workspaces at once
  raced over `server/backend/dist/` and failed now and then.

### 3. `.mcp.json` and stamping

- `.mcp.json`: the launch from step 0. `env.NOESIS_ROOT` stays
  `${CLAUDE_PROJECT_DIR}`.
- `stamp-plugin-version.ts`: drop the `.mcp.json` pin rewrite.
- `bump-version.ts`: keep the backend version bump (MCP server version), keep
  the marketplace channel pin.

### 4. Tests

- `plugins/claude-code/test/tarball.test.ts`:
  - `required` gains `server/main.js` and `server/ui/index.html`, plus an
    `server/ui/assets/index-*.js` and `.css` match. `excluded` keeps
    `servers`, and checks no `.map`, `src/` or `.spec.ts` leaks.
  - The `.mcp.json` test asserts the new command and args, and no longer reads
    `server/backend/package.json` for a `bin`. It keeps checking that the
    backend version equals the plugin version.
  - The boot test runs `bun <packageDir>/server/main.js` from another
    directory instead of the workspace `dist/`: the tarball now holds
    everything the service needs. It keeps the tool list and adds the page
    check from `pack.spec.ts` (the page is served when launched from another
    directory).
- Delete `server/backend/test/unit/pack.spec.ts`. Its stale comment points at
  `src/boot/bundle-cwd.ts`, which no longer exists.
- With one suite packing instead of two, recheck the note in `AGENT.md` about
  `test` walking workspaces one at a time. It may still hold, because the
  plugin build rewrites `server/frontend/dist`.

### 5. Release

- `.github/workflows/release.yml`: drop "Pack service" and "Publish service"
  and the service-version check; update the header comment (one package, one
  trusted publisher).
- `release-beta.ts`: no logic change. Its final message stays true.

### 6. Docs

- `plugins/claude-code/README.md`: how the service ships (line 8), the
  `.mcp.json` description (line 90), the dev override (lines 136–137) and
  "Releasing" (one package, no service-first ordering).
- `AGENT.md`: the workspace line (line 9) and the plugin section (line 91).
- `docs/arch/ARCHITECTURE.md` line 86: the plugin launches its bundled
  service, not `bunx @noesis-vision/noesis`.

## Verification

- `bun run ci` green: lint, knip (the backend loses its `bin` entry point;
  knip's `src/main.ts` entry stays), format, types, tests, e2e, build.
- Pack the plugin (`bun pm pack` in `plugins/claude-code`) and install the
  `.tgz` into a scratch project with
  `claude --plugin-dir <extracted package>`: the `noesis` MCP server connects
  with no network fetch and the page opens.
- Packed size stays around 5 MB.

## Rollout

- The next `bun run release:beta` (0.1.0-beta.5) publishes the bundled plugin
  through the existing workflow and trusted publisher. No manual npm step.
- `@noesis-vision/noesis` is never published, so nothing needs deprecating.

## Out of scope, found on the way

- `marketplace.json` pins the stable entry `noesis` to `0.1.0`, which is not on
  npm (latest there is `0.1.0-beta.4`). Installing it fails until a stable
  release exists.
- The Claude Code docs recommend a separate marketplace per release channel,
  because "one marketplace serves one version of each plugin at a time". One
  catalog with `noesis` and `noesis-beta` entries is not a pattern they
  describe.
