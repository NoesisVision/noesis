---
name: prepare-mcp-data
description: Use when preparing JSON payloads for Noesis MCP tools — provides the JSON Schema and a canonical example for each payload contract, plus a validation script to check produced JSON.
---

# Preparing MCP payloads

Every Noesis MCP tool payload has a contract. Before constructing a payload:

1. Find the contract in `references/` — each has two files:
   - `<contract>.schema.json` — the JSON Schema the payload must satisfy
   - `<contract>.example.json` — a canonical valid example
2. Build the JSON following the schema; mirror the example's shape.
3. Validate the result before using it:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/bin/validate.ts" <contract-name> <payload.json>
```

The validator exits 0 when valid and prints per-field errors otherwise.

## Available contracts

- `hello-request` — payload for the `hello` MCP tool

## Choosing the server

The `noesis-local` MCP server talks to a Noesis server app over REST. It targets
`http://localhost:3000` by default; override with the `NOESIS_SERVER_URL`
environment variable — e.g. per project in `.claude/settings.local.json`:

```json
{ "env": { "NOESIS_SERVER_URL": "https://staging.noesis.dev" } }
```

(These files are generated from `@repo/mcp-contracts` — do not edit them by hand; run `turbo generate` after changing the zod schemas.)
