// Regenerates each plugin's skills/*/references/*.json from src/contracts.
// Run via `bun run generate`. Output is committed so plugins stay
// self-contained when installed outside this monorepo; the bridge owns the
// contracts, so it also owns emitting the model-facing reference JSONs.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contracts, toJsonSchema } from '../src/contracts/index.js';

const pluginReferenceDirs = [
  '../../../plugins/claude-code/skills/prepare-mcp-data/references/',
];

for (const dir of pluginReferenceDirs) {
  const outDir = fileURLToPath(new URL(dir, import.meta.url));
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
}
