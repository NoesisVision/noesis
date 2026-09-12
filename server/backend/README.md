# @noesis-vision/noesis

The Noesis **service**: one process per agent session, started by the agent
host (Claude Code via `plugins/claude-code`, OpenCode, Codex, ...) as a
**stdio MCP server**. The same process serves the browser UI over HTTP on an
ephemeral port and opens the default browser on it once at boot. Published to
npm as a self-contained bin — agent plugins launch it with
`bunx @noesis-vision/noesis@<version>` (decision 68).

The knowledge graph files under `.noesis/` in the served repository are the
source of truth; the LadybugDB graph is an in-memory cache rebuilt from them
at boot and on every change. `src/main.ts` is the composition root: config →
`.noesis/` → graph → indexer + watcher → services → HTTP app + MCP server.
stdout belongs to the MCP protocol; all logging goes to stderr.

```sh
bun run dev        # watch mode on a fixed port (3000) for the Vite dev proxy, no browser
bun run build      # builds the ui (../frontend) into ui/ and bundles src/main.ts -> dist/main.js
bun run test       # unit tests (test/unit)
bun run test:e2e   # boots the real service over stdio and HTTP
bun run test:bench # boot re-index cost at 1k and 10k files
```

| Variable              | Meaning                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `NOESIS_ROOT`         | Repository root holding `.noesis/`; defaults to the nearest `.git` above the working dir |
| `NOESIS_OPEN_BROWSER` | `0` keeps the browser closed (headless runs, tests)                                      |
| `PORT`                | Pins the HTTP port; defaults to an ephemeral one                                         |
| `UI_DIST_PATH`        | Serve the SPA from this directory instead of the packaged `ui/` (development only)       |

The package ships `dist/main.js` (a self-contained bundle built at pack
time by `prepack`) and the built ui in `ui/`. Its only dependency is the
native `@ladybugdb/core`; workspace deps (`@repo/*`) never leak into the
published manifest. Its version is bumped in lockstep with the Claude Code
plugin by `plugins/claude-code/tools/bump-version.ts`, and the plugin's
`.mcp.json` pin is stamped from the same version source by `bun run generate`
there.
