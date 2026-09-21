// JSON Schema is what an agent reads, not the zod sources: the schemas sit
// next to domain objects nobody outside the service has a use for, and JSON
// Schema keeps the `.describe()` text while stating each shape whole, with
// no import left to follow.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { CONTRACTS } from './contracts';

const serviceRoot = fileURLToPath(new URL('../', import.meta.url));

export function contractComment(version: string): string {
  return `Generated from its zod schema by @noesis-vision/noesis ${version}. Do not edit: change the schema and regenerate.`;
}

/** File name → content: `<name>.schema.json`, and `<name>.example.json` where there is one. */
export function buildContracts(version: string): Map<string, unknown> {
  const files = new Map<string, unknown>();
  const contracts: Record<string, { schema: z.ZodType; example?: unknown }> =
    CONTRACTS;
  for (const [name, { schema, example }] of Object.entries(contracts)) {
    // The input side is the JSON an agent writes: a codec shows as the
    // string it decodes, not the value object it decodes to.
    files.set(`${name}.schema.json`, {
      $comment: contractComment(version),
      ...z.toJSONSchema(schema, { io: 'input' }),
    });
    if (example !== undefined) {
      files.set(`${name}.example.json`, z.encode(schema, example));
    }
  }
  return files;
}

/** Writes into `destination` and clears nothing: what else lives there is the caller's. */
export async function generateContracts(
  destination: string,
): Promise<string[]> {
  const { version } = JSON.parse(
    await readFile(join(serviceRoot, 'package.json'), 'utf8'),
  ) as { version: string };

  await mkdir(destination, { recursive: true });
  const files = buildContracts(version);
  for (const [file, json] of files) {
    await writeFile(
      join(destination, file),
      `${JSON.stringify(json, null, 2)}\n`,
    );
  }
  return [...files.keys()].sort();
}

if (import.meta.main) {
  const destination = process.argv[2];
  if (!destination) {
    console.error(
      'usage: bun run tools/generate-contracts.ts <destination-dir>',
    );
    process.exit(2);
  }
  const files = await generateContracts(destination);
  console.log(`generated ${files.length} contract files in ${destination}`);
}
