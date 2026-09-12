import type { Dirent } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { type Change, ChangeSchema } from '@repo/shared-contracts';
import type { NoesisDir } from '../files/noesis-dir.js';

/**
 * A change slug is a directory name, so it is the safe subset: lower-case
 * kebab-case, nothing that could climb out of `changes/`.
 */
export const CHANGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHANGE_SLUG_MAX_LENGTH = 64;

/** The metadata file inside a change directory (the `change` contract). */
export const CHANGE_FILE_NAME = 'change.json';

export function isChangeSlug(value: string): boolean {
  return (
    value.length <= CHANGE_SLUG_MAX_LENGTH && CHANGE_SLUG_PATTERN.test(value)
  );
}

/** The slug a name gets: kebab-cased, capped, never empty. */
export function slugForChange(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CHANGE_SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug || 'untitled';
}

/**
 * A change is the directory `.noesis/changes/<change>/`: everything produced
 * while working on it — imports and design docs — lands underneath, and its
 * metadata is the `change.json` file inside it. Listing is a directory read,
 * creation is a directory write, and there is no seed (decision 68).
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

  /**
   * The change's metadata. A directory without a `change.json` — made by hand
   * or before metadata existed — is still a change: it reads as a chore in
   * discovery named after its slug, stamped with the directory's birth time,
   * so the picker lists it and nothing under it is orphaned.
   */
  async readMetadata(change: string): Promise<Change | null> {
    if (!(await this.exists(change))) return null;
    try {
      const raw = await readFile(this.dirOf(change, CHANGE_FILE_NAME), 'utf8');
      return ChangeSchema.parse({ ...JSON.parse(raw), slug: change });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const { birthtime } = await stat(this.dirOf(change));
    return {
      slug: change,
      name: change,
      key: '',
      type: 'chore',
      status: 'discovery',
      created_at: birthtime.toISOString(),
      description: '',
    };
  }

  /** Writes `change.json` whole, atomically, under the change's directory. */
  async writeMetadata(change: Change): Promise<void> {
    const file = this.dirOf(change.slug, CHANGE_FILE_NAME);
    const temp = `${file}.tmp`;
    await writeFile(temp, `${JSON.stringify(change, null, 2)}\n`, 'utf8');
    await rename(temp, file);
  }
}
