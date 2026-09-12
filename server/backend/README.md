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
bun run dev        # watch mode on a fixed port (3000), SPA with HMR, no browser
bun run build      # bundles src/main.ts and the SPA it imports into dist/
bun run test       # unit tests (test/unit)
bun run test:e2e   # boots the real service over stdio and HTTP
bun run test:bench # boot re-index cost at 1k and 10k files
```

| Variable              | Meaning                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `NOESIS_ROOT`         | Repository root holding `.noesis/`; defaults to the nearest `.git` above the working dir |
| `NOESIS_OPEN_BROWSER` | `0` keeps the browser closed (headless runs, tests)                                      |
| `PORT`                | Pins the HTTP port; defaults to an ephemeral one                                         |

The package ships `dist/`: the self-contained `main.js` bin plus the SPA's
`index.html` and hashed assets, all built at pack time by `prepack` from the
`index.html` the service imports (`../frontend/index.html`). Its only dependency is the
native `@ladybugdb/core`; workspace deps (`@repo/*`) never leak into the
published manifest. Its version is bumped in lockstep with the Claude Code
plugin by `plugins/claude-code/tools/bump-version.ts`, and the plugin's
`.mcp.json` pin is stamped from the same version source by `bun run generate`
there.
