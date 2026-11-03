import { readdir } from 'node:fs/promises';
import { z } from 'zod';
import {
  CodeParserSettings,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/scanners/scanner-settings.repository';
import {
  type LibraryManifest,
  LibraryManifestSchema,
} from '#backend/app/scanners/system-model-builders/library-manifest';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/scanners/system-model-builders/namespace-config';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';
const LIBRARIES_DIR = 'libraries';

const SET_PARSER = `"parser": { "language": … } with one of: ${CodeParserSettings.options
  .map((option) => option.shape.language.value)
  .join(', ')}`;

/** Strict, so a misspelt or stale key fails instead of being dropped unread. */
const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  parser: CodeParserSettings.optional(),
}).strict();

/** `.noesis/settings.json` in the repository, and the library manifests in `.noesis/libraries/`. */
export class ScannerSettingsFileRepository implements ScannerSettingsRepository {
  private readonly noesis: NoesisDir;

  constructor(noesis: NoesisDir) {
    this.noesis = noesis;
  }

  async repositorySettings(): Promise<RepositorySettings> {
    const file = Bun.file(this.noesis.resolve(SETTINGS_FILE));
    if (!(await file.exists())) {
      throw new Error(
        `.noesis/${SETTINGS_FILE} is missing. Create it and set ${SET_PARSER}.`,
      );
    }
    const parsed = RepositorySettingsSchema.safeParse(await file.json());
    if (!parsed.success) {
      throw new Error(
        `Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    const { parser, ...namespaces } = parsed.data;
    if (parser === undefined) {
      throw new Error(
        `.noesis/${SETTINGS_FILE} names no parser. Set ${SET_PARSER}.`,
      );
    }
    return {
      parser,
      namespaces: NamespaceConfig.of(namespaces),
      libraries: await this.libraries(),
    };
  }

  /** Every `*.json` file in `.noesis/libraries/`, by file name; none without the directory. */
  private async libraries(): Promise<LibraryManifest[]> {
    const entries = await readdir(this.noesis.resolve(LIBRARIES_DIR), {
      withFileTypes: true,
    }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(({ name }) => name)
      .sort();
    const manifests: LibraryManifest[] = [];
    for (const name of names) {
      const path = `.noesis/${LIBRARIES_DIR}/${name}`;
      const parsed = LibraryManifestSchema.safeParse(
        await Bun.file(this.noesis.resolve(LIBRARIES_DIR, name))
          .json()
          .catch((error: unknown) => {
            throw new Error(`Invalid ${path}: ${String(error)}`);
          }),
      );
      if (!parsed.success) {
        throw new Error(`Invalid ${path}:\n${z.prettifyError(parsed.error)}`);
      }
      manifests.push({ ...parsed.data, path });
    }
    return manifests;
  }
}
