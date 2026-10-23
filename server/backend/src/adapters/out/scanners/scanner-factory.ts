import { z } from 'zod';
import type {
  SourceCodeScanner,
  SourceCodeScannerFactory,
} from '#backend/app/system-model/source-code-scanner';
import { ConfiguredCodeModelScanner } from './configured-code-model.scanner';
import { CSharpSourceCodeScanner } from './csharp/csharp.scanner';
import { type DummyScannerDeps, DummySourceCodeScanner } from './dummy.scanner';
import { JavaGradleSourceCodeScanner } from './java-gradle/java-gradle.scanner';
import { JavaMavenSourceCodeScanner } from './java-maven/java-maven.scanner';
import { JavaSourceCodeScanner } from './java.scanner';
import {
  loadRepositorySettings,
  RepositoryScannerName,
  type RepositorySettings,
  repositorySettingsPath,
} from './repository-settings';

/**
 * The one scanner the environment may force: `dummy` replays the implemented
 * design documents instead of reading code.
 */
const ScannerOverride = z.literal('dummy').optional();

/** What a repository scanner is built from: the repository's settings included. */
interface RepositoryScannerDeps extends DummyScannerDeps {
  settings: RepositorySettings;
}

/** The scanners `.noesis/settings.json` can name, by name. */
export type RepositoryScanners = Record<
  RepositoryScannerName,
  (deps: RepositoryScannerDeps) => SourceCodeScanner
>;

const REPOSITORY_SCANNERS: RepositoryScanners = {
  java: (deps) => new JavaSourceCodeScanner(deps),
  'java-maven': ({ settings, ...deps }) =>
    new JavaMavenSourceCodeScanner({
      ...deps,
      namespaces: settings.namespaces,
      engine: settings.engine ?? undefined,
    }),
  'java-gradle': ({ settings, ...deps }) =>
    new JavaGradleSourceCodeScanner({
      ...deps,
      namespaces: settings.namespaces,
      engine: settings.engine ?? undefined,
    }),
  csharp: ({ settings, ...deps }) =>
    new CSharpSourceCodeScanner({ ...deps, namespaces: settings.namespaces }),
  'code-model': ({ settings, ...deps }) =>
    new ConfiguredCodeModelScanner({
      ...deps,
      namespaces: settings.namespaces,
      codeModel: settings.codeModel,
    }),
  dummy: (deps) => new DummySourceCodeScanner(deps),
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
    const settings = await loadRepositorySettings(noesis);
    if (settings.scanner === null) {
      throw new Error(
        `${repositorySettingsPath(noesis)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
      );
    }
    return this.scanners[settings.scanner]({ ...this.deps, settings });
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
