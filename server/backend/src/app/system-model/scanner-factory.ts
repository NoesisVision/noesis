import {
  RepositoryScannerName,
  type RepositorySettings,
  type ScannerSettingsRepository,
} from './scanner-settings.repository';
import type { SourceCodeScanner } from './source-code-scanner';

/** How each scanner is built, by name, from the repository's settings. */
export type ScannerBuilders = Record<
  RepositoryScannerName,
  (settings: RepositorySettings) => SourceCodeScanner
>;

/**
 * The only place a scanner is chosen, at every scan: the one the repository
 * names in `.noesis/settings.json`.
 */
export class ScannerFactory {
  private readonly settings: ScannerSettingsRepository;
  private readonly scanners: ScannerBuilders;

  constructor(settings: ScannerSettingsRepository, scanners: ScannerBuilders) {
    this.settings = settings;
    this.scanners = scanners;
  }

  async create(): Promise<SourceCodeScanner> {
    const settings = await this.settings.repositorySettings();
    if (settings.scanner === null) {
      throw new Error(
        `.noesis/settings.json names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
      );
    }
    return this.scanners[settings.scanner](settings);
  }
}
