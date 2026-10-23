import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import {
  CodeModelToolSettings,
  RepositoryScannerName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/system-model/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
  codeModel: CodeModelToolSettings.optional(),
});

/** The Java presets the service once had, which a repository's build now runs through `code-model`. */
const JAVA_PRESETS = ['java-maven', 'java-gradle'];

/** `.noesis/settings.json` in the repository. */
export class ScannerSettingsFileRepository implements ScannerSettingsRepository {
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
        namespaces: NamespaceConfig.of({}),
      };
    }
    const raw: unknown = await file.json();
    refuseJavaPresets(raw, file.name ?? SETTINGS_FILE);
    const parsed = RepositorySettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    const { scanner, codeModel, ...namespaces } = parsed.data;
    return {
      scanner: scanner ?? null,
      codeModel: codeModel ?? null,
      namespaces: NamespaceConfig.of(namespaces),
    };
  }
}

/**
 * A file written for the Java presets says how to move to the build's own
 * plugin: the schema would refuse the scanner without saying so, and would
 * drop an `engine` unread, so the scan would run another engine.
 */
function refuseJavaPresets(raw: unknown, file: string): void {
  if (typeof raw !== 'object' || raw === null) return;
  const settings = raw as { scanner?: unknown; engine?: unknown };
  const move =
    'Declare the Noesis Maven or Gradle plugin in the build, with the engine in its configuration, and run it with "scanner": "code-model" and a "codeModel" command (scanners/java/README.md).';
  if (
    typeof settings.scanner === 'string' &&
    JAVA_PRESETS.includes(settings.scanner)
  ) {
    throw new Error(
      `${file} names the "${settings.scanner}" scanner, which the service no longer has. ${move}`,
    );
  }
  if ('engine' in settings) {
    throw new Error(
      `${file} sets "engine", which no scanner reads any more. ${move}`,
    );
  }
}
