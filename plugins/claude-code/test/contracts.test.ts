// The plugin's contracts/ directory is a copy of packages/shared-contracts/src
// made by `bun run generate` (decision 68): skills name a contract by this
// plugin-relative path, so the copy must exist, carry the service version in
// its header, and be byte-identical to the source below it. CI's drift check
// catches a stale copy in the diff; this catches it in `bun test`.
import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACTS_SOURCE,
  contractHeader,
  isContractFile,
  listContractFiles,
} from '../../../server/backend/tools/copy-contracts.js';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const copyDir = join(pluginRoot, 'contracts');
const serviceVersion = (
  JSON.parse(
    await readFile(
      new URL('../../../server/backend/package.json', import.meta.url),
      'utf8',
    ),
  ) as { version: string }
).version;

describe('plugins/claude-code/contracts', () => {
  test('holds exactly the contract files of packages/shared-contracts/src', async () => {
    const copied = (
      await readdir(copyDir, { recursive: true, withFileTypes: true })
    )
      .filter((e) => e.isFile())
      .map((e) => relative(copyDir, join(e.parentPath, e.name)))
      .sort();
    expect(copied).toEqual(await listContractFiles());
    expect(copied.every(isContractFile)).toBe(true);
  });

  test('each copy is the source below a header naming the service version', async () => {
    for (const file of await listContractFiles()) {
      const header = contractHeader(file, serviceVersion);
      const copy = await readFile(join(copyDir, file), 'utf8');
      const source = await readFile(join(CONTRACTS_SOURCE, file), 'utf8');
      expect(copy.startsWith(header)).toBe(true);
      expect(copy.slice(header.length)).toBe(source);
    }
  });

  test('the sources are declarative: zod and sibling contract files only', async () => {
    for (const file of await listContractFiles()) {
      if (!file.endsWith('.ts')) continue;
      const source = await readFile(join(CONTRACTS_SOURCE, file), 'utf8');
      const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map(
        (m) => m[1] ?? '',
      );
      for (const specifier of imports) {
        expect(specifier === 'zod' || specifier.startsWith('.')).toBe(true);
      }
      expect(source).not.toMatch(/\.(refine|superRefine|transform|check)\(/);
      expect(source).not.toMatch(/\.default\(\(\)/);
    }
  });
});
