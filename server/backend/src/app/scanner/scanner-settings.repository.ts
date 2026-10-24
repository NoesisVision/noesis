import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/scanner/code-model/system-model-builder/namespace-config';

/**
 * The parsers a repository can name: `code-model` runs the command line of
 * its `codeModel` block, which is how a Java repository runs the Noesis plugin
 * its build declares; `csharp` is a built-in preset of it.
 */
export const ParserName = z.enum(['csharp', 'code-model']);
export type ParserName = z.infer<typeof ParserName>;

/**
 * How the `code-model` parser runs the repository's own tool. `command` is
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

/** `.noesis/settings.json`: which parser reads the repository, how, and how its namespaces map to modules. */
export interface RepositorySettings {
  readonly parser: ParserName;
  /** Null when the file has no `codeModel` block. */
  readonly codeModel: CodeModelToolSettings | null;
  readonly namespaces: NamespaceConfig;
}

/**
 * What picks a parser: the repository's `.noesis/settings.json`. Read at
 * every scan, so a changed setting counts without a restart.
 */
export interface ScannerSettingsRepository {
  /** Throws when there is no file, or it names no parser or is invalid. */
  repositorySettings(): Promise<RepositorySettings>;
}
