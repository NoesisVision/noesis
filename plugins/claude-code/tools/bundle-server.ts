// Bundles apps/local's stdio MCP entry into a self-contained single file at
// servers/noesis-local.js. Run via `bun run bundle`. The output is gitignored —
// it is built at pack time (prepublishOnly / release workflow) and by the
// tarball smoke test, so what ships is always built from current sources.
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
