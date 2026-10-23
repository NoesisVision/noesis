import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import type { RepositorySettings } from '#backend/app/system-model/scanner-settings.repository';
import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/**
 * A scanner built anew at every scan from `.noesis/settings.json`, as
 * ScannerFactory builds it, so a spec can change the settings between scans.
 */
export function settingsScanner(
  noesis: NoesisDir,
  build: (settings: RepositorySettings) => SourceCodeScanner,
): SourceCodeScanner {
  const settings = new ScannerSettingsFileRepository(noesis);
  return {
    scan: async () => build(await settings.repositorySettings()).scan(),
  };
}
