// Stamps version pins from package.json, the single source of truth for the
// plugin version: .claude-plugin/plugin.json's version and .mcp.json's
// @noesis-vision/mcp-bridge pin (the bridge is released in lockstep with the
// plugin — decision 33). Run via `bun run generate`; CI's drift check enforces
// they stay in sync.
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

// Textual replacement (not parse/re-serialize) so Biome's JSON formatting is
// preserved — the drift check diffs this file byte-for-byte.
const mcpPath = `${root}.mcp.json`;
const mcp = await readFile(mcpPath, 'utf8');
const stamped = mcp.replace(
  /@noesis-vision\/mcp-bridge@[^"]+/g,
  `@noesis-vision/mcp-bridge@${version}`,
);
if (!stamped.includes(`@noesis-vision/mcp-bridge@${version}`)) {
  throw new Error('.mcp.json has no @noesis-vision/mcp-bridge pin to stamp');
}
await writeFile(mcpPath, stamped);
console.log(`stamped .mcp.json bridge pin -> ${version}`);
