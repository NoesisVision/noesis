# local

The local companion app: a **stdio MCP server** that bridges a coding agent
(Claude Code via `plugins/claude-code`, others planned) to the `server` app's
`/api` surface over REST.

Plain TypeScript on bun, mirroring `apps/server`'s composition-root pattern
(decision 31): `src/main.ts` wires config → `ServerClient` →
`createMcpServer` → `StdioServerTransport`. stdout belongs to the MCP
protocol; all logging goes to stderr.

```sh
bun run dev        # watch mode (stdio — mostly useful under an MCP client)
bun run test       # unit tests (test/unit)
bun run test:e2e   # full-stack e2e: boots the server app, drives a real tools/call
```

The target server is `NOESIS_SERVER_URL` (default `http://localhost:3000`),
zod-validated at startup. The Claude Code plugin bundles `src/main.ts` into
`servers/noesis-local.js` via `bun run bundle` (see
`plugins/claude-code/tools/bundle-server.ts`).
