# @repo/typescript-config

The shared tsconfig preset: one file, `base.json`, that the workspace's
TypeScript packages extend. Private and workspace-internal; nothing
publishes it.

## What `base.json` sets

Strict, ES2022, `NodeNext` module resolution, `isolatedModules`,
`noUncheckedIndexedAccess`, `skipLibCheck`, declaration output on and
`incremental` off. Every option in it is one TypeScript 7 still accepts: the
native compiler (decision D7) dropped `baseUrl`, `outFile` and the legacy
module kinds, and the preset never used them.

`tsc` is only ever run as `check-types` (`tsc --noEmit`); bun transpiles and
bundles, Biome lints. So the preset shapes type-checking, not emit, and the
`declaration` flags matter only if a package ever emits.

## Who extends it

| Package                     | Extends | Overrides                                                                  |
| --------------------------- | ------- | -------------------------------------------------------------------------- |
| `server/backend`            | yes     | `types: ["node", "bun"]`                                                   |
| `packages/shared-contracts` | yes     | `types: ["node", "bun"]`, `outDir`                                         |
| `plugins/claude-code`       | yes     | `module: Preserve`, `moduleResolution: Bundler`, `noEmit`, no declarations |
| `server/frontend`           | no      | Its own bundler-mode config: `jsx: react-jsx`, DOM libs, `#/*` path alias  |

The frontend stands alone because it is browser code bundled by bun's
fullstack mode (decision D5): DOM libs, JSX, `moduleResolution: bundler`
and `allowImportingTsExtensions` have no place in a Node-style preset.

## Changing it

Edit `base.json` and run `bun run check-types` from the repo root; every
workspace that extends the preset is checked. The TypeScript version itself
is pinned once in the root `package.json` catalog, not here.
