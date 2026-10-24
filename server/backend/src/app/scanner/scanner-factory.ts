import type { Clock } from '#backend/app/clock';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import type { ScanLog } from './scan-log';
import { Scanner } from './scanner';
import {
  ParserName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from './scanner-settings.repository';
import type { SourceRepository } from './source-repository';

/** How each scanner's parser is built, by name, from the repository's settings. */
export type CodeParsers = Record<
  ParserName,
  (settings: RepositorySettings) => CodeParser
>;

/**
 * The only place a scanner is chosen, at every scan: the parser the
 * repository names in `.noesis/settings.json`, and a builder over its
 * namespace settings.
 */
export class ScannerFactory {
  private readonly settings: ScannerSettingsRepository;
  private readonly parsers: CodeParsers;
  private readonly repository: SourceRepository;
  private readonly clock: Clock;
  private readonly log: ScanLog;

  constructor(
    settings: ScannerSettingsRepository,
    parsers: CodeParsers,
    repository: SourceRepository,
    clock: Clock,
    log: ScanLog,
  ) {
    this.settings = settings;
    this.parsers = parsers;
    this.repository = repository;
    this.clock = clock;
    this.log = log;
  }

  async create(): Promise<Scanner> {
    const settings = await this.settings.repositorySettings();
    if (settings.parser === null) {
      throw new Error(
        `.noesis/settings.json names no parser. Set "parser" to one of: ${ParserName.options.join(', ')}.`,
      );
    }
    return new Scanner({
      parser: this.parsers[settings.parser](settings),
      builder: new SystemModelBuilder(settings.namespaces),
      repository: this.repository,
      clock: this.clock,
      log: this.log,
    });
  }
}
