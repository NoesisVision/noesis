// Bundles apps/local's stdio MCP entry into a self-contained single file at
// servers/noesis-local.js. Run via `bun run generate` (or `turbo generate`).
// The output is committed so the plugin works without the monorepo's node_modules.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const entry = `${repoRoot}apps/local/src/mcp.ts`;
const outfile = fileURLToPath(
  new URL('../servers/noesis-local.js', import.meta.url),
);

// Same optional-dependency externals as the app's own build script — Nest
// lazy-requires these in try/catch, so the bundle runs fine without them.
const externals = [
  'class-transformer',
  'class-validator',
  '@nestjs/microservices',
  '@nestjs/websockets',
].flatMap((dep) => ['--external', dep]);

const result = spawnSync(
  'bun',
  ['build', entry, '--outfile', outfile, '--target', 'bun', ...externals],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
