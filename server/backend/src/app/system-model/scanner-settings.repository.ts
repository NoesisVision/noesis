import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/code-model/projection/namespace-config';

/** The scanners a repository can name; a language may have more than one. */
export const RepositoryScannerName = z.enum(['java', 'csharp']);
export type RepositoryScannerName = z.infer<typeof RepositoryScannerName>;

/** The one scanner the environment may force: `dummy`. */
export type ForcedScannerName = 'dummy';

/** `.noesis/settings.json`: which scanner reads the repository, how its namespaces map to modules. */
export interface RepositorySettings {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  readonly namespaces: NamespaceConfig;
}

/**
 * What picks a scanner: the environment (`NOESIS_SCANNER`) and the
 * repository's `.noesis/settings.json`. Read at every scan, so a changed
 * setting counts without a restart.
 */
export interface ScannerSettingsRepository {
  /** The scanner the environment forces; `null` when it forces none. */
  forcedScanner(): Promise<ForcedScannerName | null>;

  /** No file names no scanner and maps every namespace to itself. */
  repositorySettings(): Promise<RepositorySettings>;
}
