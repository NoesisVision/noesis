// Copies the zod contract sources from @repo/mcp-contracts (and its
// @repo/shared-contracts dependency) into contracts/, rewriting package
// imports to relative ones so the installed plugin is self-contained.
// Run via `bun run generate`. Output is committed — CI fails on drift.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

// Rewrites `@repo/shared-contracts` (and its `/subpath` form) to a relative
// specifier pointing at contracts/shared/, from the copied file's location.
function rewriteImports(source: string, destRel: string): string {
  const toShared = path.posix.relative(
    path.posix.dirname(destRel),
    'contracts/shared',
  );
  const prefix = toShared.startsWith('.') ? toShared : `./${toShared}`;
  return source
    .replace(/'@repo\/shared-contracts\/([^']+)'/g, `'${prefix}/$1.js'`)
    .replaceAll("'@repo/shared-contracts'", `'${prefix}/index.js'`);
}

for (const { from, to } of copies) {
  const srcRoot = `${packagesRoot}${from}`;
  for (const entry of await readdir(srcRoot, { recursive: true })) {
    const rel = entry.split(path.sep).join('/');
    // Copy contract sources only — tests stay in the source packages.
    if (!rel.endsWith('.ts') || rel.endsWith('.spec.ts')) continue;
    const destRel = `${to}${rel}`;
    const source = await readFile(`${srcRoot}${rel}`, 'utf8');
    await mkdir(path.dirname(`${pluginRoot}${destRel}`), { recursive: true });
    await writeFile(
      `${pluginRoot}${destRel}`,
      HEADER + rewriteImports(source, destRel),
    );
    console.log(`copied ${from}${rel} -> ${destRel}`);
  }
}
