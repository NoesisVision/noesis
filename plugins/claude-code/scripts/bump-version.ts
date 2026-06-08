// Bumps the plugin version in package.json and .claude-plugin/plugin.json, and
// advances the *stable* marketplace entry. Marketplace entries pinned to a
// dist-tag (e.g. "beta") are channel pointers and left untouched; semver-pinned
// (stable) entries advance only on a stable release, never on a prerelease.
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
  const isPrerelease = version.includes('-');
  const plugins = json.plugins as { source: { version: string } }[];
  for (const plugin of plugins) {
    // Dist-tag pointers (e.g. "beta") track a channel — never repin them.
    if (!/^\d+\.\d+\.\d+/.test(plugin.source.version)) continue;
    // Semver-pinned (stable) entries advance only on a stable release.
    if (isPrerelease) continue;
    plugin.source.version = version;
  }
});
