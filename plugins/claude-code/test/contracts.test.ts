// contracts/ is a gitignored build output, so the test builds it
// before asserting on it. What the files hold is the service's to assert,
// in server/backend/test/unit/contracts-json-schema.spec.ts.
import { beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildContracts,
  DESTINATION_README,
} from '../tools/build-contracts.js';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const contractsDir = join(pluginRoot, 'contracts');
const skillsDir = join(pluginRoot, 'skills');

describe('plugins/claude-code/contracts', () => {
  beforeAll(async () => {
    // Leftovers of an earlier build, which a fresh one must clear.
    await mkdir(join(contractsDir, 'stale'), { recursive: true });
    await writeFile(join(contractsDir, 'stale', 'gone.schema.json'), '{}\n');
    await buildContracts(contractsDir);
  });

  test('holds the README and the generated JSON, and nothing left over', async () => {
    const entries = await readdir(contractsDir, { recursive: true });
    expect(entries).toContain(DESTINATION_README);
    const generated = entries.filter((f) => f !== DESTINATION_README);
    expect(generated.length).toBeGreaterThan(0);
    expect(
      generated.filter((f) => !/^[a-z-]+\.(schema|example)\.json$/.test(f)),
    ).toEqual([]);
  });

  test('every contract a skill names is there to read', async () => {
    const skills = (await readdir(skillsDir, { recursive: true })).filter((f) =>
      f.endsWith('SKILL.md'),
    );
    const named: string[] = [];
    for (const skill of skills) {
      const text = await readFile(join(skillsDir, skill), 'utf8');
      // Bare file names count too: a skill names a second contract as
      // "beside" the first.
      named.push(...(text.match(/[a-z-]+\.(schema|example)\.json/g) ?? []));
    }
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((f) => !existsSync(join(contractsDir, f)))).toEqual([]);
  });

  // A skill installs the newest parser release, which it looks up; a
  // literal version would go stale with the next release.
  test('no skill pins a Noesis artifact to a literal version', async () => {
    const skills = (await readdir(skillsDir, { recursive: true })).filter((f) =>
      f.endsWith('SKILL.md'),
    );
    const literal = [
      /vision\.noesis[\w.-]*:[\w.-]+:\d+\.\d+\.\d+/g,
      /<artifactId>noesis-[\w-]+<\/artifactId>\s*<version>\d+\.\d+\.\d+/g,
      /version\s+'\d+\.\d+\.\d+[^']*'/g,
      /version\s+"\d+\.\d+\.\d+[^"]*"/g,
    ];
    const pinned: string[] = [];
    for (const skill of skills) {
      const text = await readFile(join(skillsDir, skill), 'utf8');
      for (const pattern of literal) {
        pinned.push(
          ...(text.match(pattern) ?? []).map((match) => `${skill}: ${match}`),
        );
      }
    }
    expect(pinned).toEqual([]);
  });
});
