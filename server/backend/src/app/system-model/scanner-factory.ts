import type { NamespaceConfig } from '#backend/app/code-model/projection/namespace-config';
import {
  type ForcedScannerName,
  RepositoryScannerName,
  type ScannerSettingsRepository,
} from './scanner-settings.repository';
import type { SourceCodeScanner } from './source-code-scanner';

/** How each scanner is built, by name; repository scanners take the namespace settings. */
export type ScannerBuilders = Record<
  ForcedScannerName,
  () => SourceCodeScanner
> &
  Record<
    RepositoryScannerName,
    (namespaces: NamespaceConfig) => SourceCodeScanner
  >;

/**
 * The only place a scanner is chosen, at every scan: the dummy when the
 * environment forces it, otherwise the one the repository names in
 * `.noesis/settings.json`.
 */
export class ScannerFactory {
  constructor(
    private readonly settings: ScannerSettingsRepository,
    private readonly scanners: ScannerBuilders,
  ) {}

  async create(): Promise<SourceCodeScanner> {
    const forced = await this.settings.forcedScanner();
    if (forced !== null) return this.scanners[forced]();
    const { scanner, namespaces } = await this.settings.repositorySettings();
    if (scanner === null) {
      throw new Error(
        `.noesis/settings.json names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
      );
    }
    return this.scanners[scanner](namespaces);
  }
}
