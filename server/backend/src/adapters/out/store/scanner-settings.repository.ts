import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import {
  CodeModelToolSettings,
  JavaScannerEngine,
  RepositoryScannerName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/system-model/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
  codeModel: CodeModelToolSettings.optional(),
  engine: JavaScannerEngine.optional(),
});

/** `.noesis/settings.json` in the repository. */
export class NoesisScannerSettingsRepository implements ScannerSettingsRepository {
  private readonly noesis: NoesisDir;

  constructor(noesis: NoesisDir) {
    this.noesis = noesis;
  }

  async repositorySettings(): Promise<RepositorySettings> {
    const file = Bun.file(this.noesis.resolve(SETTINGS_FILE));
    if (!(await file.exists())) {
      return {
        scanner: null,
        codeModel: null,
        engine: null,
        namespaces: NamespaceConfig.of({}),
      };
    }
    const parsed = RepositorySettingsSchema.safeParse(await file.json());
    if (!parsed.success) {
      throw new Error(
        `Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    const { scanner, codeModel, engine, ...namespaces } = parsed.data;
    if (
      engine !== undefined &&
      scanner !== 'java-maven' &&
      scanner !== 'java-gradle'
    ) {
      throw new Error(
        `${file.name} sets "engine", which only the java-maven and java-gradle scanners read; with "code-model" put -Dnoesis.engine or -Pnoesis.engine in the command.`,
      );
    }
    return {
      scanner: scanner ?? null,
      codeModel: codeModel ?? null,
      engine: engine ?? null,
      namespaces: NamespaceConfig.of(namespaces),
    };
  }
}
