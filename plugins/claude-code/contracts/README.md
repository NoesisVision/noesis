# Contracts

This directory is a build output. In a checkout it holds only this file; in
the published plugin it holds the contract sources every knowledge graph file
and import payload must satisfy: zod `.ts` schemas the model reads directly,
and a companion `.md` per family for what the shapes cannot say.

The files are copied from `packages/shared-contracts/src` by the plugin's
`bun run build` (which `bun pm pack` runs as `prepack`, so a packed tarball
always carries them), each stamped with a header naming the plugin version
they ship in. Skills name a contract by a path under this directory
(`${CLAUDE_PLUGIN_ROOT}/contracts/...`), and the plugin's tests assert that
the copy is byte-identical to the source below the header.

Do not edit anything here by hand: change the source in
`packages/shared-contracts/src` and rebuild.
