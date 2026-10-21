// The code model is written by scanners in other languages (.NET today,
// Java next), which cannot read the zod sources. JSON Schema is the one
// readable copy they write against; it is committed and `bun run generate`
// keeps it current, as it does the plugin's version pins.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  CodeModelFile,
  ScanManifest,
} from '#backend/app/code-model/code-model';
import { contractComment } from './generate-contracts';

const serviceRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultDestination = join(
  serviceRoot,
  '../../scanners/code-model',
);

const SCHEMAS: Record<string, { schema: z.ZodType; title: string }> = {
  'code-model': {
    schema: CodeModelFile,
    title: 'Noesis code model: one artifact of a scan',
  },
  manifest: {
    schema: ScanManifest,
    title: 'Noesis code model: the manifest of a scan',
  },
};

/** File name → JSON Schema: `<name>.schema.json` for the manifest and the model file. */
export function buildCodeModelSchemas(version: string): Map<string, unknown> {
  const files = new Map<string, unknown>();
  for (const [name, { schema, title }] of Object.entries(SCHEMAS)) {
    files.set(`${name}.schema.json`, {
      $comment: contractComment(version),
      title,
      ...z.toJSONSchema(schema, { io: 'input' }),
    });
  }
  return files;
}

export async function generateCodeModelSchemas(
  destination: string,
): Promise<string[]> {
  const { version } = JSON.parse(
    await readFile(join(serviceRoot, 'package.json'), 'utf8'),
  ) as { version: string };

  await mkdir(destination, { recursive: true });
  const files = buildCodeModelSchemas(version);
  for (const [file, json] of files) {
    await writeFile(
      join(destination, file),
      `${JSON.stringify(json, null, 2)}\n`,
    );
  }
  return [...files.keys()].sort();
}

if (import.meta.main) {
  const destination = process.argv[2] ?? defaultDestination;
  const files = await generateCodeModelSchemas(destination);
  console.log(`generated ${files.length} schema files in ${destination}`);
}
