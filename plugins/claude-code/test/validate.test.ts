// Smoke-tests the shipped validator (scripts/validate.ts) against the
// committed skill references: every contract's example.json must validate
// against its schema, proving the generated forms (zod copy, JSON Schema,
// example) stay in sync.
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contracts } from '../contracts';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));

function runValidate(args: string[]) {
  return spawnSync('bun', [join(pluginRoot, 'scripts/validate.ts'), ...args], {
    encoding: 'utf8',
  });
}

describe('scripts/validate.ts', () => {
  for (const name of Object.keys(contracts)) {
    test(`accepts the committed ${name} example`, () => {
      const example = join(
        pluginRoot,
        `skills/prepare-mcp-data/references/${name}.example.json`,
      );
      const result = runValidate([name, example]);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });
  }

  test('rejects a payload that does not match the schema', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'noesis-validate-'));
    try {
      const file = join(dir, 'bad.json');
      await writeFile(file, JSON.stringify({ unexpected: true }));
      const result = runValidate(['hello-request', file]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('INVALID');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('rejects an unknown contract name', () => {
    const result = runValidate(['no-such-contract', 'irrelevant.json']);
    expect(result.status).toBe(2);
  });
});
