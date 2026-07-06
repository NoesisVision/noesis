---
name: prepare-mcp-data
description: Use when preparing JSON payloads for Noesis MCP tools — provides the JSON Schema and a canonical example for each payload contract.
---

# Preparing MCP payloads

Every Noesis MCP tool payload has a contract. Before constructing a payload:

1. Find the contract in `references/` — each has two files:
   - `<contract>.schema.json` — the JSON Schema the payload must satisfy
   - `<contract>.example.json` — a canonical valid example
2. Build the JSON following the schema; mirror the example's shape.
3. Call the tool. The MCP server validates every payload against its contract:
   if the payload does not match, the tool returns an error describing each
   failing field plus a valid example — fix the payload accordingly and call
   the tool again.

## Available contracts

- `hello-request` — payload for the `hello` MCP tool

## Choosing the server

The `noesis-local` MCP server talks to a Noesis server app over REST. It targets
`http://localhost:3000` by default; override with the `NOESIS_SERVER_URL`
environment variable — e.g. per project in `.claude/settings.local.json`:

```json
{ "env": { "NOESIS_SERVER_URL": "https://staging.noesis.dev" } }
```

(These files are generated from `@repo/mcp-contracts` — do not edit them by hand; run `bun run generate` after changing the zod schemas.)
