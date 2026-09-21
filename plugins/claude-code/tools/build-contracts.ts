// The service owns the contracts and generates them; the plugin only decides
// where they land and what ships beside them.
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = fileURLToPath(
  new URL('../../../server/backend/', import.meta.url),
);

export const DESTINATION_README = 'README.md';

export async function buildContracts(destination: string): Promise<void> {
  // Start clean so a contract the service no longer generates disappears.
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(destination)) {
    if (entry === DESTINATION_README) continue;
    await rm(join(destination, entry), { recursive: true, force: true });
  }
  const generate = spawnSync('bun', ['run', 'contracts', destination], {
    cwd: serviceRoot,
    encoding: 'utf8',
  });
  if (generate.status !== 0) {
    throw new Error(`the service generated no contracts:\n${generate.stderr}`);
  }
}

if (import.meta.main) {
  const destination = process.argv[2];
  if (!destination) {
    console.error('usage: bun run tools/build-contracts.ts <destination-dir>');
    process.exit(2);
  }
  const resolved = join(process.cwd(), destination);
  await buildContracts(resolved);
  const files = (await readdir(resolved)).filter(
    (f) => f !== DESTINATION_README,
  );
  console.log(`built ${files.length} contract files in ${destination}`);
}
