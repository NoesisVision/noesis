import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/scanner/code-model/system-model-builder/namespace-config';
import {
  CodeModelToolSettings,
  ParserName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from '#backend/app/scanner/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  parser: ParserName.optional(),
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
        parser: null,
        codeModel: null,
        namespaces: NamespaceConfig.of({}),
      };
    }
    const raw: unknown = await file.json();
    refuseRetiredSettings(raw, file.name ?? SETTINGS_FILE);
    const parsed = RepositorySettingsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`,
      );
    }
    const { parser, codeModel, ...namespaces } = parsed.data;
    return {
      parser: parser ?? null,
      codeModel: codeModel ?? null,
      namespaces: NamespaceConfig.of(namespaces),
    };
  }
}

/**
 * A file written for an older service says what to change: the schema would
 * drop a `scanner` or an `engine` unread, so the scan would run no parser or
 * another engine. A Java preset moves to the build's own plugin.
 */
function refuseRetiredSettings(raw: unknown, file: string): void {
  if (typeof raw !== 'object' || raw === null) return;
  const settings = raw as { scanner?: unknown; engine?: unknown };
  const move =
    'Declare the Noesis Maven or Gradle plugin in the build, with the engine in its configuration, and run it with "parser": "code-model" and a "codeModel" command (parsers/java/README.md).';
  if (
    typeof settings.scanner === 'string' &&
    JAVA_PRESETS.includes(settings.scanner)
  ) {
    throw new Error(
      `${file} names the "${settings.scanner}" scanner, which the service no longer has. ${move}`,
    );
  }
  if ('scanner' in settings) {
    throw new Error(
      `${file} sets "scanner", which is now "parser": rename the key, keeping its value.`,
    );
  }
  if ('engine' in settings) {
    throw new Error(
      `${file} sets "engine", which no parser reads any more. ${move}`,
    );
  }
}
