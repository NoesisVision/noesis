#!/usr/bin/env bun
// Publishes screenshots for a pull request on the orphan `pr-screenshots`
// branch, under a folder named after the PR, and prints the Markdown that
// shows them. See ../SKILL.md.
//
// Usage: bun publish-screenshots.ts --pr <number> [--repo owner/name] <file.png>...
//
// The commit is built with git plumbing and a throwaway index, so the working
// tree, the index and the checked-out branch are never touched. The branch
// shares no history with `main` and is never merged. The links name the
// commit, not the branch, so a later push to the folder cannot change what an
// older description shows. The repository is public, so raw.githubusercontent
// serves them to every reader.
//
// The push skips the pre-push hook: it runs the full CI against the working
// tree, which says nothing about a branch that holds only images.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';

const BRANCH = 'pr-screenshots';

const { values, positionals } = parseArgs({
  options: { pr: { type: 'string' }, repo: { type: 'string' } },
  allowPositionals: true,
});
const pr = values.pr;
if (!pr || !/^\d+$/.test(pr) || positionals.length === 0) {
  console.error('usage: bun publish-screenshots.ts --pr <number> <file.png>...');
  process.exit(2);
}

// The repository the links point at: the one `gh` sees, unless named.
const repo =
  values.repo ??
  (await $`gh repo view --json nameWithOwner -q .nameWithOwner`.text()).trim();

// The branch as the remote has it now, if it exists yet.
const fetched = await $`git fetch --quiet origin ${BRANCH}`.nothrow().quiet();
const parent =
  fetched.exitCode === 0
    ? (await $`git rev-parse FETCH_HEAD`.text()).trim()
    : undefined;

const scratch = mkdtempSync(join(tmpdir(), 'pr-screenshots-'));
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') };
  if (parent) await $`git read-tree ${parent}`.env(env);
  for (const file of positionals) {
    const blob = (await $`git hash-object -w ${file}`.text()).trim();
    const path = `${pr}/${basename(file)}`;
    await $`git update-index --add --cacheinfo 100644,${blob},${path}`.env(env);
  }
  const tree = (await $`git write-tree`.env(env).text()).trim();
  const message = `chore: screenshots for #${pr}`;
  const commit = parent
    ? (await $`git commit-tree ${tree} -p ${parent} -m ${message}`.text()).trim()
    : (await $`git commit-tree ${tree} -m ${message}`.text()).trim();
  await $`git push --quiet --no-verify origin ${commit}:refs/heads/${BRANCH}`;

  for (const file of positionals) {
    const name = basename(file);
    const alt = name.replace(/\.png$/i, '').replaceAll('-', ' ');
    console.log(
      `![${alt}](https://raw.githubusercontent.com/${repo}/${commit}/${pr}/${name})`,
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
