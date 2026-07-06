// Regenerates skills/*/references/*.json from @repo/mcp-contracts.
// Run via `bun run generate`. Output is committed so the
// plugin stays self-contained when installed outside this monorepo.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contracts, toJsonSchema } from '@repo/mcp-contracts';

const outDir = fileURLToPath(
  new URL('../skills/prepare-mcp-data/references/', import.meta.url),
);
await mkdir(outDir, { recursive: true });

for (const [name, entry] of Object.entries(contracts)) {
  await writeFile(
    `${outDir}${name}.schema.json`,
    `${JSON.stringify(toJsonSchema(entry), null, 2)}\n`,
  );
  await writeFile(
    `${outDir}${name}.example.json`,
    `${JSON.stringify(entry.example, null, 2)}\n`,
  );
  console.log(`generated ${name}.schema.json + ${name}.example.json`);
}
