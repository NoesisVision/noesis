import type { Clock } from '#backend/app/clock';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import type { ScanLog } from './scan-log';
import { Scanner } from './scanner';
import type {
  CodeParserSettings,
  ScannerSettingsRepository,
} from './scanner-settings.repository';
import type { SourceRepository } from './source-repository';

/** Builds the parser the repository's settings name, from its settings. */
export type CreateCodeParser = (settings: CodeParserSettings) => CodeParser;

/**
 * The only place a scanner is chosen, at every scan: the parser the
 * repository names in `.noesis/settings.json`, and a builder over its
 * namespace settings.
 */
export class ScannerFactory {
  private readonly settings: ScannerSettingsRepository;
  private readonly createParser: CreateCodeParser;
  private readonly repository: SourceRepository;
  private readonly clock: Clock;
  private readonly log: ScanLog;

  constructor(
    settings: ScannerSettingsRepository,
    createParser: CreateCodeParser,
    repository: SourceRepository,
    clock: Clock,
    log: ScanLog,
  ) {
    this.settings = settings;
    this.createParser = createParser;
    this.repository = repository;
    this.clock = clock;
    this.log = log;
  }

  async create(): Promise<Scanner> {
    const settings = await this.settings.repositorySettings();
    return new Scanner({
      parser: this.createParser(settings.parser),
      builder: new SystemModelBuilder(settings.namespaces),
      repository: this.repository,
      clock: this.clock,
      log: this.log,
    });
  }
}
