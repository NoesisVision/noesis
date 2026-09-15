import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Directories no scanner enters, at any depth, on top of its own list. */
const ALWAYS_SKIPPED = new Set(['node_modules', '.noesis']);

/**
 * Every file under `dir` accepted by `accept`, depth-first in directory
 * order. Dot-directories and the scanner's `skipped` directories are never
 * entered; an unreadable directory yields nothing.
 */
export async function walk(
  dir: string,
  accept: (fileName: string) => boolean,
  skipped: ReadonlySet<string>,
): Promise<string[]> {
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
      if (
        ALWAYS_SKIPPED.has(entry.name) ||
        skipped.has(entry.name) ||
        entry.name.startsWith('.')
      )
        continue;
      out.push(...(await walk(path, accept, skipped)));
    } else if (entry.isFile() && accept(entry.name)) {
      out.push(path);
    }
  }
  return out;
}
