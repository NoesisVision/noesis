// Copies the zod contract sources from @repo/mcp-contracts (and its
// @repo/shared-contracts dependency) into contracts/, rewriting package
// imports to relative ones so the installed plugin is self-contained.
// Run via `bun run generate`. Output is committed — CI fails on drift.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const packagesRoot = fileURLToPath(
  new URL('../../../packages/', import.meta.url),
);

const HEADER =
  '// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.\n';

const copies: { from: string; to: string }[] = [
  { from: 'shared-contracts/src/', to: 'contracts/shared/' },
  { from: 'mcp-contracts/src/', to: 'contracts/' },
];

for (const { from, to } of copies) {
  const outDir = `${pluginRoot}${to}`;
  await mkdir(outDir, { recursive: true });
  for (const file of await readdir(`${packagesRoot}${from}`)) {
    if (!file.endsWith('.ts')) continue;
    const source = await readFile(`${packagesRoot}${from}${file}`, 'utf8');
    const rewritten = source.replaceAll(
      "'@repo/shared-contracts'",
      "'./shared/index.js'",
    );
    await writeFile(`${outDir}${file}`, HEADER + rewritten);
    console.log(`copied ${from}${file} -> ${to}${file}`);
  }
}
