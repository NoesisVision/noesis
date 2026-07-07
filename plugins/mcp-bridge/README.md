# @noesis-vision/mcp-bridge

The Noesis **stdio MCP bridge**: connects a coding agent (Claude Code via
`plugins/claude-code`, OpenCode, Codex, ...) to the `server` app's `/api`
surface over REST. Published to npm as a self-contained bin (decision 33) —
agent plugins launch it with `bunx @noesis-vision/mcp-bridge@<version>`
instead of shipping their own bundle.

Plain TypeScript on bun, mirroring `server/backend`'s composition-root pattern
(decision 31): `src/main.ts` wires config → `ServerClient` →
`createMcpServer` → `StdioServerTransport`. stdout belongs to the MCP
protocol; all logging goes to stderr.

```sh
bun run dev        # watch mode (stdio — mostly useful under an MCP client)
bun run build      # bundle src/main.ts -> dist/main.js (the published bin)
bun run test       # unit tests (test/unit)
bun run test:e2e   # full-stack e2e: boots the server app, drives a real tools/call
```

The target server is `NOESIS_SERVER_URL` (default `http://localhost:3000`),
zod-validated at startup.

The package ships only `dist/main.js` — a fully self-contained bundle built at
publish time (`prepublishOnly`), so `bunx` installs are instant and workspace
deps (`@repo/*-contracts`) never leak into the published manifest. Its version
is bumped in lockstep with the Claude Code plugin by
`plugins/claude-code/tools/bump-version.ts`, and the plugin's `.mcp.json` pin
is stamped from the same version source by `bun run generate` there.
