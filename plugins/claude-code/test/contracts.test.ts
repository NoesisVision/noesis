// The plugin's contracts/ directory is a build output: a copy of
// packages/shared-contracts/src made by `bun run build` (decision D4).
// Skills name a contract by this plugin-relative path, so the copy must hold
// exactly the source files, carry the plugin version in its header, and be
// byte-identical to the source below it. The copy is gitignored, so the test
// builds it first and asserts on the result.
import { beforeAll, describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACTS_SOURCE,
  contractHeader,
  copyContracts,
  DESTINATION_README,
  isContractFile,
  listContractFiles,
} from '../tools/copy-contracts.js';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const copyDir = join(pluginRoot, 'contracts');
const pluginVersion = (
  JSON.parse(await readFile(join(pluginRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

describe('plugins/claude-code/contracts', () => {
  beforeAll(async () => {
    await copyContracts(copyDir);
  });

  test('holds the README and exactly the contract files of packages/shared-contracts/src', async () => {
    const entries = (
      await readdir(copyDir, { recursive: true, withFileTypes: true })
    )
      .filter((e) => e.isFile())
      .map((e) => relative(copyDir, join(e.parentPath, e.name)))
      .sort();
    expect(entries).toContain(DESTINATION_README);
    const copied = entries.filter((f) => f !== DESTINATION_README);
    expect(copied).toEqual(await listContractFiles());
    expect(copied.every(isContractFile)).toBe(true);
  });

  test('each copy is the source below a header naming the plugin version', async () => {
    for (const file of await listContractFiles()) {
      const header = contractHeader(file, pluginVersion);
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
