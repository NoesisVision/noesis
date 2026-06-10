// Cuts a new beta release end-to-end: bumps to the next prerelease version,
// regenerates stamped artifacts, smoke-tests the real tarball, then commits,
// tags, and pushes — the v* tag triggers the Release workflow, which publishes
// to npm under the `beta` dist-tag via trusted publishing.
// Usage: bun run release:beta [version]
//   Without an argument the current beta counter is incremented
//   (0.1.0-beta.2 -> 0.1.0-beta.3). From a stable version pass the target
//   prerelease explicitly, e.g. `bun run release:beta 0.2.0-beta.1`.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function bun(args: string[]) {
  const result = spawnSync('bun', args, { cwd: pluginRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// --- preflight: clean main, in sync with origin -------------------------
if (git(['status', '--porcelain']) !== '') {
  fail('Working tree is not clean — commit or stash first.');
}
if (git(['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') {
  fail('Releases are cut from main.');
}
git(['fetch', 'origin', 'main']);
const behind = git(['rev-list', '--count', 'HEAD..origin/main']);
if (behind !== '0') {
  fail(`main is ${behind} commit(s) behind origin/main — pull first.`);
}

// --- pick the next version ----------------------------------------------
const { version: current } = JSON.parse(
  await readFile(`${pluginRoot}package.json`, 'utf8'),
) as { version: string };

let next = process.argv[2];
if (next) {
  // Must be a prerelease — a stable version here would advance the stable
  // marketplace channel instead of the beta one.
  if (!/^\d+\.\d+\.\d+-[\w.]+$/.test(next)) {
    fail(`"${next}" is not a prerelease semver (expected e.g. 0.2.0-beta.1).`);
  }
} else {
  const match = current.match(/^(\d+\.\d+\.\d+-beta\.)(\d+)$/);
  if (!match) {
    fail(
      `Current version ${current} is not a beta — pass the target version explicitly.`,
    );
  }
  next = `${match[1]}${Number(match[2]) + 1}`;
}
if (git(['tag', '--list', `v${next}`]) !== '') {
  fail(`Tag v${next} already exists.`);
}

console.log(`Releasing ${current} -> ${next}\n`);

// --- bump, regenerate, smoke-test the packed tarball ---------------------
bun(['run', 'bump', next]);
bun(['run', 'generate']);
bun(['test']);

// --- commit, tag, push — the tag triggers the npm publish ----------------
git(['add', '--all']);
git(['commit', '-m', `Release ${next}`]);
git(['tag', '-a', `v${next}`, '-m', `Release ${next}`]);
git(['push', 'origin', 'main', `v${next}`]);

console.log(
  `\nPushed v${next} — the Release workflow publishes it to the beta dist-tag.`,
);
console.log(
  'Watch it with: gh run watch "$(gh run list --workflow=release.yml -L1 --json databaseId -q \'.[0].databaseId\')"',
);
