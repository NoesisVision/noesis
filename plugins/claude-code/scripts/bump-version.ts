// Bumps the plugin version in the three files that must stay in sync:
// package.json, .claude-plugin/plugin.json, .claude-plugin/marketplace.json.
// Usage: `bun run bump 0.2.0` (from plugins/claude-code).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Usage: bun run bump <semver> (e.g. bun run bump 0.2.0)');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));

async function update(
  relPath: string,
  mutate: (json: Record<string, unknown>) => void,
) {
  const path = `${root}${relPath}`;
  const json = JSON.parse(await readFile(path, 'utf8')) as Record<
    string,
    unknown
  >;
  mutate(json);
  await writeFile(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`bumped ${relPath} -> ${version}`);
}

await update('package.json', (json) => {
  json.version = version;
});
await update('.claude-plugin/plugin.json', (json) => {
  json.version = version;
});
await update('.claude-plugin/marketplace.json', (json) => {
  const plugins = json.plugins as { source: { version: string } }[];
  for (const plugin of plugins) {
    plugin.source.version = version;
  }
});
