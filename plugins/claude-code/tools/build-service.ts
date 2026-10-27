// The service is built in its own workspace and shipped inside the plugin, so
// an installed plugin starts it from its own directory with no npm fetch.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = fileURLToPath(
  new URL('../../../server/backend/', import.meta.url),
);

// The bundle and the page beside it, named so nothing else in dist/ ships.
const SHIPPED = ['main.js', 'ui'];

export async function buildService(destination: string): Promise<void> {
  const build = spawnSync('bun', ['run', 'build'], {
    cwd: serviceRoot,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(`the service did not build:\n${build.stderr}`);
  }
  // Start clean so a file the service no longer builds disappears.
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const entry of SHIPPED) {
    await cp(join(serviceRoot, 'dist', entry), join(destination, entry), {
      recursive: true,
    });
  }
}

if (import.meta.main) {
  const destination = process.argv[2];
  if (!destination) {
    console.error('usage: bun run tools/build-service.ts <destination-dir>');
    process.exit(2);
  }
  await buildService(join(process.cwd(), destination));
  console.log(`built the service into ${destination}`);
}
