// The app-relative layout is kept so the contracts' relative imports still
// resolve. `.ts` sources ship deliberately: compiled output would keep the
// types and lose the `.describe()` text (decision D4).
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACTS_SOURCE = fileURLToPath(
  new URL('../../../server/backend/src/app/', import.meta.url),
);

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));

export function contractHeader(relativePath: string, version: string): string {
  const text = `Copied from server/backend/src/app/${relativePath} by @noesis-vision/claude-code-plugin ${version}. Do not edit: run \`bun run build\`.`;
  return relativePath.endsWith('.md')
    ? `<!-- ${text} -->\n\n`
    : `// ${text}\n\n`;
}

export const DESTINATION_README = 'README.md';

export function isContractFile(relativePath: string): boolean {
  return (
    relativePath.split(sep)[1] === 'model' &&
    (relativePath.endsWith('.ts') || relativePath.endsWith('.md')) &&
    !relativePath.endsWith('.spec.ts')
  );
}

export async function listContractFiles(): Promise<string[]> {
  const entries = await readdir(CONTRACTS_SOURCE, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(CONTRACTS_SOURCE, join(e.parentPath, e.name)))
    .filter(isContractFile)
    .sort();
}

export async function copyContracts(destination: string): Promise<string[]> {
  const { version } = JSON.parse(
    await readFile(join(pluginRoot, 'package.json'), 'utf8'),
  ) as { version: string };

  // Start clean so a contract deleted at the source disappears from the copy.
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(destination)) {
    if (entry === DESTINATION_README) continue;
    await rm(join(destination, entry), { recursive: true, force: true });
  }
  const files = await listContractFiles();
  for (const file of files) {
    const source = await readFile(join(CONTRACTS_SOURCE, file), 'utf8');
    const target = join(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${contractHeader(file, version)}${source}`);
  }
  return files;
}

if (import.meta.main) {
  const destination = process.argv[2];
  if (!destination) {
    console.error('usage: bun run tools/copy-contracts.ts <destination-dir>');
    process.exit(2);
  }
  const files = await copyContracts(destination);
  console.log(`copied ${files.length} contract files to ${destination}`);
}
