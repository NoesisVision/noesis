import { GitSourceRepository } from '#backend/adapters/out/scanner/git-source-repository';
import { ServerScanLog } from '#backend/adapters/out/scanner/server-scan-log';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import type { Clock } from '#backend/app/clock';
import type { CodeParser } from '#backend/app/scanner/code-model/code-parser';
import type { NamespaceConfig } from '#backend/app/scanner/code-model/system-model-builder/namespace-config';
import { SystemModelBuilder } from '#backend/app/scanner/code-model/system-model-builder/system-model-builder';
import { Scanner } from '#backend/app/scanner/scanner';
import type { ScannerFactory } from '#backend/app/scanner/scanner-factory';
import type { RepositorySettings } from '#backend/app/scanner/scanner-settings.repository';
import type { SystemModel } from '#backend/app/scanner/system-model/system-model';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The scanner the service builds over `parser`, for the repository `noesis` is in. */
export function scannerOver(
  noesis: NoesisDir,
  parser: CodeParser,
  namespaces: NamespaceConfig,
  clock: Clock,
): Scanner {
  return new Scanner({
    parser,
    builder: new SystemModelBuilder(namespaces),
    repository: new GitSourceRepository(noesis.root),
    clock,
    log: new ServerScanLog(),
  });
}

/**
 * A scanner built anew at every scan from `.noesis/settings.json`, as
 * ScannerFactory builds it, so a spec can change the settings between scans.
 * Unlike the factory, it scans a file that names no parser.
 */
export function settingsScanner(
  noesis: NoesisDir,
  parser: (settings: RepositorySettings) => CodeParser,
  clock: Clock,
): Pick<Scanner, 'scan'> {
  const settings = new ScannerSettingsFileRepository(noesis);
  return {
    scan: async () => {
      const repository = await settings.repositorySettings();
      return scannerOver(
        noesis,
        parser(repository),
        repository.namespaces,
        clock,
      ).scan();
    },
  };
}

/** What a fake factory hands out: only what the scan handler calls. */
export type FakeScanner = Pick<Scanner, 'scan'>;

/** A fake ScannerFactory; its private fields keep a literal from matching it. */
export function fakeScannerFactory(
  create: () => Promise<FakeScanner>,
): ScannerFactory {
  return { create } as unknown as ScannerFactory;
}

/** A factory whose scanner always finds `model`. */
export function scannerFinding(model: SystemModel): ScannerFactory {
  return fakeScannerFactory(() =>
    Promise.resolve({ scan: () => Promise.resolve(model) }),
  );
}
