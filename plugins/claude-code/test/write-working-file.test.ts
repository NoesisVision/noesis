import { afterAll, beforeAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWorkingFile,
  titleOf,
} from '../skills/add-document-to-change/scripts/write-working-file';

const script = fileURLToPath(
  new URL(
    '../skills/add-document-to-change/scripts/write-working-file.ts',
    import.meta.url,
  ),
);

// Everything JSON has to escape, plus front matter the script must not strip.
const SOURCE =
  '---\nowner: "zoë"\n---\n\n# Payment retry ##\n\nTabs\there, a \\ backslash, "quotes", emoji 🚀.\r\n\n# Second heading\n';

let workDir: string;
let sourcePath: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'noesis-working-file-'));
  sourcePath = join(workDir, 'retry-notes.md');
  await writeFile(sourcePath, SOURCE);
  await utimes(sourcePath, new Date(2026, 2, 5, 12), new Date(2026, 2, 5, 12));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

test('content is the source verbatim; title and date are derived', async () => {
  expect(await buildWorkingFile(sourcePath, {}, new Date(2026, 8, 24))).toEqual(
    {
      id: '2026-09-24-payment-retry',
      title: 'Payment retry',
      date: '2026-03-05',
      content: SOURCE,
    },
  );
});

test('a new document gets an id minted from its title and today', async () => {
  const { id } = await buildWorkingFile(
    sourcePath,
    { title: 'Zażółć notes' },
    new Date(2026, 0, 2),
  );
  expect(id).toBe('2026-01-02-zazolc-notes');
});

test('a file without a heading is titled by its name', () => {
  expect(
    titleOf('no heading\n## only a subheading\n', '/x/retry-notes.md'),
  ).toBe('retry-notes');
});

test('the script writes the working file and honours the overrides', async () => {
  const workingPath = join(workDir, 'scratch', 'retry-notes.json');
  const run = spawnSync(
    'bun',
    [
      script,
      sourcePath,
      workingPath,
      '--id',
      '2026-01-01-payment-retry',
      '--title',
      'Retry',
      '--date',
      '2026-01-02',
    ],
    { encoding: 'utf8' },
  );
  expect(run.status).toBe(0);
  expect(JSON.parse(run.stdout)).toMatchObject({
    path: workingPath,
    id: '2026-01-01-payment-retry',
    title: 'Retry',
    date: '2026-01-02',
  });
  expect(JSON.parse(await readFile(workingPath, 'utf8'))).toEqual({
    id: '2026-01-01-payment-retry',
    title: 'Retry',
    date: '2026-01-02',
    content: SOURCE,
  });
});

test('the script fails without both paths', () => {
  const run = spawnSync('bun', [script, sourcePath], { encoding: 'utf8' });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('Usage:');
});
