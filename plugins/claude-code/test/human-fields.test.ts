import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanFields } from '../skills/update-design-doc/scripts/human-fields';

const script = fileURLToPath(
  new URL(
    '../skills/update-design-doc/scripts/human-fields.ts',
    import.meta.url,
  ),
);

const byHuman = (value: unknown) => ({ changed: true, value, author: 'human' });
const byAgent = (value: unknown) => ({ changed: true, value, author: 'agent' });

const DESIGN_DOC = {
  name: 'Partial refunds',
  description: 'Refunds single lines.',
  modules: {
    added: [
      {
        id: 'module|sales',
        name: byAgent('sales'),
        definition: byHuman('Selling to customers.'),
        diagram: { changed: false },
        rules: { added: [], removed: [], modified: [] },
      },
    ],
    removed: ['module|legacy'],
    modified: [],
  },
  behaviours: {
    added: [],
    removed: [],
    modified: [
      {
        id: 'behavior|sales.Order.refund',
        visibility: byHuman({ kind: 'public', actors: ['Support agent'] }),
        output: {
          added: [{ type: 'primitive|boolean', description: byHuman('Done.') }],
          removed: [],
          modified: [],
        },
      },
    ],
  },
  implemented: false,
};

const HUMAN_FIELDS = [
  {
    path: 'modules.added[module|sales].definition',
    value: 'Selling to customers.',
  },
  {
    path: 'behaviours.modified[behavior|sales.Order.refund].visibility',
    value: { kind: 'public', actors: ['Support agent'] },
  },
  {
    path: 'behaviours.modified[behavior|sales.Order.refund].output.added[primitive|boolean].description',
    value: 'Done.',
  },
];

let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-human-fields-'));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

test('names every field a human wrote or accepted, with its value', () => {
  expect(humanFields(DESIGN_DOC)).toEqual(HUMAN_FIELDS);
});

test('the script prints them and leaves the working file as it was', async () => {
  const workingPath = join(workDir, 'design-doc.json');
  const contents = JSON.stringify(DESIGN_DOC);
  await writeFile(workingPath, contents);

  const run = spawnSync('bun', [script, workingPath], { encoding: 'utf8' });

  expect(run.status).toBe(0);
  expect(JSON.parse(run.stdout)).toEqual(HUMAN_FIELDS);
  expect(await readFile(workingPath, 'utf8')).toBe(contents);
});

test('the script fails without a path', () => {
  const run = spawnSync('bun', [script], { encoding: 'utf8' });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('Usage:');
});
