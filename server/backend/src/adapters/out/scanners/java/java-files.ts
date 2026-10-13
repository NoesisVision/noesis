import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';

/*
 * The main Java sources of a checkout: every `.java` file under the root
 * except tests, build output, tool caches and the files that declare
 * packages and modules rather than types. Nothing declares which
 * directories hold sources, so the walk reads them all and skips by name.
 */

/** Directories never entered, at any depth: build outputs and tool caches. */
const SKIPPED_DIRS = new Set([
  'build',
  'target',
  'out',
  'bin',
  'node_modules',
  '.gradle',
  '.noesis',
]);

/** Files that declare a package or a module rather than types. */
const IGNORED_FILES = new Set(['package-info.java', 'module-info.java']);

const TEST_SOURCE_ROOT = `${sep}src${sep}test${sep}`;

/** Every main-source `.java` file under `root`, absolute, sorted by path. */
export async function findJavaSources(root: string): Promise<string[]> {
  const files = await walk(root);
  return files
    .filter((file) => !file.includes(TEST_SOURCE_ROOT))
    .sort((a, b) => a.localeCompare(b));
}

/** Dot-directories and the skipped ones are never entered; an unreadable directory yields nothing. */
async function walk(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      out.push(...(await walk(path)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.java') &&
      !IGNORED_FILES.has(entry.name)
    ) {
      out.push(path);
    }
  }
  return out;
}
