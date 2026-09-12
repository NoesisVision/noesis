// Stamps version pins from package.json, the single source of truth for the
// plugin version: .claude-plugin/plugin.json's version and .mcp.json's
// @noesis-vision/noesis pin (the service is released in lockstep with the
// plugin — one version train, decisions 33 and 68). Run via `bun run
// generate`; CI's drift check enforces they stay in sync.
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
// preserved — the drift check diffs this file byte-for-byte. The pin is the
// default of a `${NOESIS_SERVICE_ENTRY:-...}` expansion (decision 73), so the
// match stops at the closing brace.
const mcpPath = `${root}.mcp.json`;
const mcp = await readFile(mcpPath, 'utf8');
const stamped = mcp.replace(
  /@noesis-vision\/noesis@[^"}]+/g,
  `@noesis-vision/noesis@${version}`,
);
if (!stamped.includes(`@noesis-vision/noesis@${version}`)) {
  throw new Error('.mcp.json has no @noesis-vision/noesis pin to stamp');
}
await writeFile(mcpPath, stamped);
console.log(`stamped .mcp.json service pin -> ${version}`);
