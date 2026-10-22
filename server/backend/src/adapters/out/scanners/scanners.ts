import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';
import type { ScannerOverride } from '#backend/platform/config/config';
import { CSharpSourceCodeScanner } from './csharp/csharp.scanner';
import { type DummyScannerDeps, DummySourceCodeScanner } from './dummy.scanner';
import { JavaSourceCodeScanner } from './java.scanner';
import {
  loadRepositorySettings,
  noScannerConfigured,
  type RepositoryScannerName,
} from './repository-settings';

/** The scanners a repository's `.noesis/settings.json` can name, by name. */
export type RepositoryScanners = Record<
  RepositoryScannerName,
  (deps: DummyScannerDeps) => SourceCodeScanner
>;

const REPOSITORY_SCANNERS: RepositoryScanners = {
  java: (deps) => new JavaSourceCodeScanner(deps),
  csharp: (deps) => new CSharpSourceCodeScanner(deps),
};

/**
 * Scans with the scanner the repository names in `.noesis/settings.json`,
 * read at every scan so a changed file counts without a restart.
 */
class ConfiguredSourceCodeScanner implements SourceCodeScanner {
  constructor(
    private readonly deps: DummyScannerDeps,
    private readonly scanners: RepositoryScanners,
  ) {}

  async scan(): Promise<SystemModel> {
    const { noesis } = this.deps;
    const { scanner } = await loadRepositorySettings(noesis);
    if (scanner === null) throw noScannerConfigured(noesis);
    return this.scanners[scanner](this.deps).scan();
  }
}

/**
 * The scanner the scan handler gets: the one the repository configures,
 * unless `override` asks for the dummy, which replays the implemented design
 * documents instead of reading code. `deps` is what the dummy replays from;
 * the language scanners take the repository root and the clock from it.
 */
export function createScanner(
  override: ScannerOverride | undefined,
  deps: DummyScannerDeps,
  scanners: RepositoryScanners = REPOSITORY_SCANNERS,
): SourceCodeScanner {
  return override === 'dummy'
    ? new DummySourceCodeScanner(deps)
    : new ConfiguredSourceCodeScanner(deps, scanners);
}
