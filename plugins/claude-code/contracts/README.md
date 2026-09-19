# Contracts

This directory is a build output (decision D4). In a checkout it holds only
this file; in the published plugin it holds the contract sources every
knowledge graph file and import payload must satisfy: zod `.ts` schemas the
model reads directly and the `.fixture.ts` examples. It is the one readable copy of
the contracts anywhere; the service bundles the same schemas into its
executable and ships none (decision D4).

## How it is made

`tools/copy-contracts.ts` (decision D4) copies every
`server/backend/src/app/<feature>/model/` folder here, keeping the path
relative to `src/app/` so the contracts' relative imports still resolve:
every `.ts` and `.md` (only the schemas and fixtures today), each prefixed
with a header naming the plugin version it ships in, byte-identical to the
source below that header. It empties the directory first so a contract deleted at
the source disappears from the copy, keeping only this README.

It runs as the plugin's `bun run build` (`bun run build:plugin` from the
repo root), as `prepack` so a packed tarball always carries a fresh copy,
and inside the plugin's tests, which build the copy and assert the file
list, the header and the byte-identity. `.ts` is shipped on purpose: compiled
output would keep the types and lose the `.describe()` text the model reads
(decision D4).

## How it is read

Skills name a contract by a path under this directory, as
`${CLAUDE_PLUGIN_ROOT}/contracts/<feature>/model/<contract>.ts`, and read it with the
model's own file tool at the step that produces the file. Contracts never
travel over MCP. The layout mirrors `server/backend/src/app/`; see
`server/backend/README.md` for the family table.

Do not edit anything here by hand: change the source in
`server/backend/src/app/<feature>/model/` and rebuild.
