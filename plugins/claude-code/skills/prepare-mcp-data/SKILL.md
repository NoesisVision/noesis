---
name: prepare-mcp-data
description: Use when preparing a file for a Noesis MCP tool — provides the JSON Schema and a canonical example for each file contract, and the write-validate-import flow the tools expect.
---

# Preparing files for Noesis MCP tools

Noesis tools never take content inline. They take the path of a working file
you write under `.noesis/tmp/` in the repository, and answer with text — or,
when the answer is large, with the path of a file they wrote there for you.

The MCP server's instructions name this session's scratch directory
(`.noesis/tmp/<session-id>/`). Write your working files there; no tool call is
needed to create or find it, and it is deleted when the session ends.

## Flow

1. Find the contract in `references/` — each has two files:
   - `<contract>.schema.json` — the JSON Schema the file must satisfy
   - `<contract>.example.json` — a canonical valid example
2. Write the JSON to a working file in the scratch directory, following the
   schema and mirroring the example's shape.
3. Call `validate` with the contract name and the working file path. It
   answers with a numbered issue list — location, expected versus found, and a
   one-line fix per issue — capped, with the count of suppressed issues. Edit
   the working file in place and validate again until it reports no issues.
4. Call the tool that consumes the file (below). It validates once more and
   rejects with the same issue list, so a clean `validate` means a clean write.

## Available contracts and tools

- `design-document` — a design document; consumed by `create-design-doc`,
  which takes the change slug (a directory under `.noesis/changes/`) and the
  working file path.

(These files are generated from the service's `src/mcp/contracts` — do not edit them by hand; run `bun run generate` after changing the zod schemas.)
