import type { Dirent } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import type { NoesisDir } from '../files/noesis-dir.js';

/**
 * A change slug is a directory name, so it is the safe subset: lower-case
 * kebab-case, nothing that could climb out of `changes/`.
 */
export const CHANGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHANGE_SLUG_MAX_LENGTH = 64;

export function isChangeSlug(value: string): boolean {
  return (
    value.length <= CHANGE_SLUG_MAX_LENGTH && CHANGE_SLUG_PATTERN.test(value)
  );
}

/**
 * A change is the directory `.noesis/changes/<change>/`: everything produced
 * while working on it — imports and design docs — lands underneath. Listing
 * is a directory read, creation is a directory write, and there is no seed
 * (decision 68).
 */
export class ChangesRepository {
  private readonly noesis: NoesisDir;

  constructor(noesis: NoesisDir) {
    this.noesis = noesis;
  }

  /** The change's directory. Throws on a slug that is not a safe dir name. */
  dirOf(change: string, ...segments: string[]): string {
    if (!isChangeSlug(change)) {
      throw new Error(`Not a change slug: ${JSON.stringify(change)}`);
    }
    return this.noesis.resolve('changes', change, ...segments);
  }

  /** Every change, sorted by slug. Non-directories and dot entries are not changes. */
  async list(): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.noesis.resolve('changes'), {
        withFileTypes: true,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  }

  async exists(change: string): Promise<boolean> {
    return (await this.list()).includes(change);
  }

  /** Creates the directory; answers whether it was new. */
  async create(change: string): Promise<boolean> {
    if (await this.exists(change)) return false;
    await mkdir(this.dirOf(change), { recursive: true });
    return true;
  }
}
