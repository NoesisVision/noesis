import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/code-model/system-model-builder/namespace-config';

/**
 * The scanners a repository can name: `code-model` runs the command line of
 * its `codeModel` block, which is how a Java repository runs the Noesis plugin
 * its build declares; `csharp` is a built-in preset of it.
 */
export const RepositoryScannerName = z.enum(['csharp', 'code-model']);
export type RepositoryScannerName = z.infer<typeof RepositoryScannerName>;

/**
 * How the `code-model` scanner runs the repository's own tool. `command` is
 * the whole command line, run from the repository root; `{out}`, `{root}` and
 * `{name}` in an argument stand for the output directory, the repository root
 * and the repository name. The tool must leave a `code-model/<language>/`
 * tree under `{out}`.
 */
export const CodeModelToolSettings = z.object({
  command: z.array(z.string()).min(1),
  /** What to tell someone on whose machine the command cannot be started. */
  installHint: z.string().optional(),
});
export type CodeModelToolSettings = z.infer<typeof CodeModelToolSettings>;

/** `.noesis/settings.json`: which scanner reads the repository, how, and how its namespaces map to modules. */
export interface RepositorySettings {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  /** Null when the file has no `codeModel` block. */
  readonly codeModel: CodeModelToolSettings | null;
  readonly namespaces: NamespaceConfig;
}

/**
 * What picks a scanner: the repository's `.noesis/settings.json`. Read at
 * every scan, so a changed setting counts without a restart.
 */
export interface ScannerSettingsRepository {
  /** No file names no scanner and maps every namespace to itself. */
  repositorySettings(): Promise<RepositorySettings>;
}
