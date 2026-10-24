import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/scanners/system-model-builders/namespace-config';
import {
  CodeParserSettings,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/scanners/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

const SET_PARSER = `"parser": { "language": … } with one of: ${CodeParserSettings.options
  .map((option) => option.shape.language.value)
  .join(', ')}`;

/** Strict, so a misspelt or stale key fails instead of being dropped unread. */
const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  parser: CodeParserSettings.optional(),
}).strict();

/** `.noesis/settings.json` in the repository. */
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
    };
  }
}
