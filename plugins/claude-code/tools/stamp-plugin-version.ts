import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const { version } = JSON.parse(
  await readFile(`${root}package.json`, 'utf8'),
) as { version: string };

const manifestPath = `${root}.claude-plugin/plugin.json`;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
  string,
  unknown
>;
manifest.version = version;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`stamped .claude-plugin/plugin.json -> ${version}`);
