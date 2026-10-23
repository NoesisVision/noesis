import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import {
  ParserName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from './scanner-settings.repository';
import {
  SourceCodeScanner,
  type SourceCodeScannerDeps,
} from './source-code-scanner';

/** How each scanner's parser is built, by name, from the repository's settings. */
export type CodeParsers = Record<
  ParserName,
  (settings: RepositorySettings) => CodeParser
>;

/** What every scanner shares, whichever parser it runs. */
export type ScanningDeps = Omit<SourceCodeScannerDeps, 'parser' | 'builder'>;

/**
 * The only place a scanner is chosen, at every scan: the parser the
 * repository names in `.noesis/settings.json`, and a builder over its
 * namespace settings.
 */
export class ScannerFactory {
  private readonly settings: ScannerSettingsRepository;
  private readonly parsers: CodeParsers;
  private readonly scanning: ScanningDeps;

  constructor(
    settings: ScannerSettingsRepository,
    parsers: CodeParsers,
    scanning: ScanningDeps,
  ) {
    this.settings = settings;
    this.parsers = parsers;
    this.scanning = scanning;
  }

  async create(): Promise<SourceCodeScanner> {
    const settings = await this.settings.repositorySettings();
    if (settings.parser === null) {
      throw new Error(
        `.noesis/settings.json names no parser. Set "parser" to one of: ${ParserName.options.join(', ')}.`,
      );
    }
    return new SourceCodeScanner({
      ...this.scanning,
      parser: this.parsers[settings.parser](settings),
      builder: new SystemModelBuilder(settings.namespaces),
    });
  }
}
