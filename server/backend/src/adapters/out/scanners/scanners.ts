import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { SystemModel } from '#backend/app/system-model/system-model';
import { ConfiguredCodeModelScanner } from './configured-code-model.scanner';
import { CSharpSourceCodeScanner } from './csharp/csharp.scanner';
import { type DummyScannerDeps, DummySourceCodeScanner } from './dummy.scanner';
import { JavaGradleSourceCodeScanner } from './java-gradle/java-gradle.scanner';
import { JavaMavenSourceCodeScanner } from './java-maven/java-maven.scanner';
import { JavaSourceCodeScanner } from './java.scanner';
import {
  loadNoesisConfig,
  noScannerConfigured,
  type RepositoryScannerName,
} from './noesis-config';

/** The scanners a repository's `noesis-config.json` can name, by name. */
export type RepositoryScanners = Record<
  RepositoryScannerName,
  (deps: DummyScannerDeps) => SourceCodeScanner
>;

const REPOSITORY_SCANNERS: RepositoryScanners = {
  java: (deps) => new JavaSourceCodeScanner(deps),
  'java-maven': (deps) => new JavaMavenSourceCodeScanner(deps),
  'java-gradle': (deps) => new JavaGradleSourceCodeScanner(deps),
  csharp: (deps) => new CSharpSourceCodeScanner(deps),
  'code-model': (deps) => new ConfiguredCodeModelScanner(deps),
  dummy: (deps) => new DummySourceCodeScanner(deps),
};

/**
 * Scans with the scanner the repository names in `noesis-config.json`, read
 * at every scan so a changed file counts without a restart.
 */
class ConfiguredSourceCodeScanner implements SourceCodeScanner {
  constructor(
    private readonly deps: DummyScannerDeps,
    private readonly scanners: RepositoryScanners,
  ) {}

  async scan(): Promise<SystemModel> {
    const root = this.deps.noesis.root;
    const { scanner } = await loadNoesisConfig(root);
    if (scanner === null) throw noScannerConfigured(root);
    return this.scanners[scanner](this.deps).scan();
  }
}

/**
 * The scanner the scan handler gets: the one the repository configures, and
 * nothing else; the environment names no scanner. `deps` is what the dummy
 * replays from; the language scanners take the repository root and the clock
 * from it.
 */
export function createScanner(
  deps: DummyScannerDeps,
  scanners: RepositoryScanners = REPOSITORY_SCANNERS,
): SourceCodeScanner {
  return new ConfiguredSourceCodeScanner(deps, scanners);
}
