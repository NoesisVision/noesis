import { GitSourceRepository } from '#backend/adapters/out/scanner/git-source-repository';
import { ServerScanLog } from '#backend/adapters/out/scanner/server-scan-log';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import type { Now } from '#backend/app/clock';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import type { NamespaceConfig } from '#backend/app/scanner/code-model/system-model-builder/namespace-config';
import { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import type { RepositorySettings } from '#backend/app/scanner/system-model/scanner-settings.repository';
import { SourceCodeScanner } from '#backend/app/scanner/system-model/source-code-scanner';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The scanner the service builds over `parser`, for the repository `noesis` is in. */
export function scannerOver(
  noesis: NoesisDir,
  parser: CodeParser,
  namespaces: NamespaceConfig,
  now: Now,
): SourceCodeScanner {
  return new SourceCodeScanner({
    parser,
    builder: new SystemModelBuilder(namespaces),
    repository: new GitSourceRepository(noesis.root),
    now,
    log: new ServerScanLog(),
  });
}

/**
 * A scanner built anew at every scan from `.noesis/settings.json`, as
 * ScannerFactory builds it, so a spec can change the settings between scans.
 * Unlike the factory, it scans a file that names no scanner.
 */
export function settingsScanner(
  noesis: NoesisDir,
  parser: (settings: RepositorySettings) => CodeParser,
  now: Now,
): Pick<SourceCodeScanner, 'scan'> {
  const settings = new ScannerSettingsFileRepository(noesis);
  return {
    scan: async () => {
      const repository = await settings.repositorySettings();
      return scannerOver(
        noesis,
        parser(repository),
        repository.namespaces,
        now,
      ).scan();
    },
  };
}
