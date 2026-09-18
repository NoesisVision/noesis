// The service's layer rules (decision D3), checked by `bun run lint:deps`:
//
//   shared    contracts and value objects; imports no other layer
//   platform  technical services (files, database, logging); shared only
//   app       the core: services and the ports they need; shared only
//   adapters  implement app's ports over platform, and drive app (MCP)
//   ui        the HTTP surfaces; drive app, may use platform
//   src/*.ts  the composition root; wires everything, imported by nobody
//
// Runs under bun (`bun --bun depcruise`: the CLI refuses node 25) and parses
// with swc: the repo's TypeScript 7 has no compiler API for it to load.

const LAYER = '^src/(shared|platform|app|adapters|ui)/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'shared-imports-no-layer',
      comment: 'shared is the kernel every layer builds on; it builds on none.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/', pathNot: '^src/shared/' },
    },
    {
      name: 'contracts-stay-declarative',
      comment:
        'Contracts import zod and sibling contracts only: the plugin copies them verbatim (decision D4).',
      severity: 'error',
      from: { path: '^src/shared/contracts/' },
      to: { pathNot: ['^src/shared/contracts/', 'node_modules/zod/'] },
    },
    {
      name: 'platform-imports-shared-only',
      comment:
        'platform is generic technical plumbing; it knows nothing of app, adapters or ui.',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/', pathNot: '^src/(platform|shared)/' },
    },
    {
      name: 'app-imports-shared-only',
      comment:
        'app is the core: it declares the ports it needs and adapters implement them. Import the port, not platform.',
      severity: 'error',
      from: { path: '^src/app/' },
      to: { path: '^src/', pathNot: '^src/(app|shared)/' },
    },
    {
      name: 'adapters-not-to-ui',
      severity: 'error',
      from: { path: '^src/adapters/' },
      to: { path: '^src/ui/' },
    },
    {
      name: 'ui-not-to-adapters',
      comment:
        'ui reaches the core through app services, not through adapters.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'composition-root-not-imported',
      comment:
        'main.ts, app.ts and their helpers wire the layers; no layer depends on them.',
      severity: 'error',
      from: { path: LAYER },
      to: { path: '^src/[^/]+$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // swc parses the TypeScript source itself, so type-only imports count.
    // No `tsConfig`/`tsPreCompilationDeps`: both ask for the compiler API.
    parser: 'swc',
    enhancedResolveOptions: {
      extensions: ['.ts', '.js'],
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
