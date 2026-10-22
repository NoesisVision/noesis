import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

/** The scanners a repository can name; a language may have more than one. */
export const RepositoryScannerName = z.enum(['java', 'csharp']);
export type RepositoryScannerName = z.infer<typeof RepositoryScannerName>;

/**
 * `.noesis/settings.json` in the repository: which scanner reads the
 * repository and how its namespaces map to modules.
 */
const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
});

export interface RepositorySettings {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  readonly namespaces: NamespaceConfig;
}

/** Reads the file; no file names no scanner and maps every namespace to itself. */
export async function loadRepositorySettings(
  noesis: NoesisDir,
): Promise<RepositorySettings> {
  const file = Bun.file(noesis.resolve(SETTINGS_FILE));
  if (!(await file.exists())) {
    return { scanner: null, namespaces: NamespaceConfig.of({}) };
  }
  const parsed = RepositorySettingsSchema.safeParse(await file.json());
  if (!parsed.success) {
    throw new Error(`Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`);
  }
  const { scanner, ...namespaces } = parsed.data;
  return {
    scanner: scanner ?? null,
    namespaces: NamespaceConfig.of(namespaces),
  };
}

/** What a scan needs when the repository names no scanner. */
export function noScannerConfigured(noesis: NoesisDir): Error {
  return new Error(
    `${noesis.resolve(SETTINGS_FILE)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
  );
}
