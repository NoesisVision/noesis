import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/code-model/projection/namespace-config';
import type {
  SourceCodeScanner,
  SourceCodeScannerFactory,
} from '#backend/app/system-model/source-code-scanner';
import { CSharpSourceCodeScanner } from './csharp/csharp.scanner';
import { type DummyScannerDeps, DummySourceCodeScanner } from './dummy.scanner';
import { JavaSourceCodeScanner } from './java.scanner';
import {
  loadRepositorySettings,
  RepositoryScannerName,
  repositorySettingsPath,
} from './repository-settings';

/**
 * The one scanner the environment may force: `dummy` replays the implemented
 * design documents instead of reading code.
 */
const ScannerOverride = z.literal('dummy').optional();

/** What a repository scanner is built from: the repository's namespace settings included. */
interface RepositoryScannerDeps extends DummyScannerDeps {
  namespaces: NamespaceConfig;
}

/** The scanners `.noesis/settings.json` can name, by name. */
export type RepositoryScanners = Record<
  RepositoryScannerName,
  (deps: RepositoryScannerDeps) => SourceCodeScanner
>;

const REPOSITORY_SCANNERS: RepositoryScanners = {
  java: (deps) => new JavaSourceCodeScanner(deps),
  csharp: (deps) => new CSharpSourceCodeScanner(deps),
};

/**
 * The only place a scanner is chosen, at every scan: the dummy when
 * `NOESIS_SCANNER=dummy`, otherwise the one the repository names in
 * `.noesis/settings.json`.
 */
export class ScannerFactory implements SourceCodeScannerFactory {
  constructor(
    private readonly deps: DummyScannerDeps,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly scanners: RepositoryScanners = REPOSITORY_SCANNERS,
  ) {}

  async create(): Promise<SourceCodeScanner> {
    if (this.dummyForced()) return new DummySourceCodeScanner(this.deps);
    const { noesis } = this.deps;
    const { scanner, namespaces } = await loadRepositorySettings(noesis);
    if (scanner === null) {
      throw new Error(
        `${repositorySettingsPath(noesis)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
      );
    }
    return this.scanners[scanner]({ ...this.deps, namespaces });
  }

  private dummyForced(): boolean {
    const parsed = ScannerOverride.safeParse(this.env.NOESIS_SCANNER);
    if (!parsed.success) {
      throw new Error(
        `NOESIS_SCANNER may only be "dummy"; the repository names its own scanner in .noesis/settings.json.`,
      );
    }
    return parsed.data === 'dummy';
  }
}
