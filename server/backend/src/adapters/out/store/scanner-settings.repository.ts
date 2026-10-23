import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import {
  type ForcedScannerName,
  RepositoryScannerName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/system-model/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

const ScannerOverride = z.literal('dummy').optional();

const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
});

/** `NOESIS_SCANNER` from `env`, `.noesis/settings.json` from the repository. */
export class NoesisScannerSettingsRepository implements ScannerSettingsRepository {
  constructor(
    private readonly noesis: NoesisDir,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async forcedScanner(): Promise<ForcedScannerName | null> {
    const parsed = ScannerOverride.safeParse(this.env.NOESIS_SCANNER);
    if (!parsed.success) {
      throw new Error(
        `NOESIS_SCANNER may only be "dummy"; the repository names its own scanner in .noesis/settings.json.`,
      );
    }
    return parsed.data ?? null;
  }

  async repositorySettings(): Promise<RepositorySettings> {
    const file = Bun.file(this.noesis.resolve(SETTINGS_FILE));
    if (!(await file.exists())) {
      return { scanner: null, namespaces: NamespaceConfig.of({}) };
    }
    const parsed = RepositorySettingsSchema.safeParse(await file.json());
    if (!parsed.success) {
      throw new Error(
        `Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    const { scanner, ...namespaces } = parsed.data;
    return {
      scanner: scanner ?? null,
      namespaces: NamespaceConfig.of(namespaces),
    };
  }
}
