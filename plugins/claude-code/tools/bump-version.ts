// Bumps the plugin version in package.json (the single version source — run
// `bun run generate` afterwards to stamp .claude-plugin/plugin.json and the
// .mcp.json bridge pin), the mcp-bridge package released in lockstep with it
// (decision 33), and the matching marketplace channel entry. Marketplace npm
// sources only document exact-semver pins (no dist-tags), so each entry stays
// pinned: the beta entry always to a prerelease, the stable entry to a stable
// release. A bump advances only the entries of its own channel.
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
  await writeFile(path, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`bumped ${relPath} -> ${version}`);
}

await update('package.json', (json) => {
  json.version = version;
});
await update('../../packages/mcp-bridge/package.json', (json) => {
  json.version = version;
});
await update('.claude-plugin/marketplace.json', (json) => {
  const isPrerelease = version.includes('-');
  const plugins = json.plugins as { source: { version: string } }[];
  for (const plugin of plugins) {
    // An entry belongs to the channel its current pin is on; prerelease bumps
    // advance prerelease pins, stable bumps advance stable pins.
    if (plugin.source.version.includes('-') === isPrerelease) {
      plugin.source.version = version;
    }
  }
});
console.log(
  'Now run `bun run generate` to stamp .claude-plugin/plugin.json, then commit and tag.',
);
