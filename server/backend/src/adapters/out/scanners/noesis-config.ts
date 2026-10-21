import { join } from 'node:path';
import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';

const CONFIG_FILE = 'noesis-config.json';

/** The scanners a repository can name; a language may have more than one. */
export const RepositoryScannerName = z.enum(['java', 'csharp']);
export type RepositoryScannerName = z.infer<typeof RepositoryScannerName>;

/**
 * `noesis-config.json` at the repository root: which scanner reads the
 * repository and how its namespaces map to modules.
 */
const NoesisConfigSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
});

export interface NoesisConfig {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  readonly namespaces: NamespaceConfig;
}

/** Reads the file; no file names no scanner and maps every namespace to itself. */
export async function loadNoesisConfig(
  repositoryRoot: string,
): Promise<NoesisConfig> {
  const file = Bun.file(join(repositoryRoot, CONFIG_FILE));
  if (!(await file.exists())) {
    return { scanner: null, namespaces: NamespaceConfig.of({}) };
  }
  const parsed = NoesisConfigSchema.safeParse(await file.json());
  if (!parsed.success) {
    throw new Error(
      `Invalid ${CONFIG_FILE}:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const { scanner, ...namespaces } = parsed.data;
  return {
    scanner: scanner ?? null,
    namespaces: NamespaceConfig.of(namespaces),
  };
}

/** What a scan needs when the repository names no scanner. */
export function noScannerConfigured(repositoryRoot: string): Error {
  return new Error(
    `${join(repositoryRoot, CONFIG_FILE)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
  );
}
