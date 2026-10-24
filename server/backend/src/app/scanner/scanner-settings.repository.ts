import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/scanner/code-model/system-model-builder/namespace-config';

/**
 * The parsers a repository can name: `csharp` runs `noesis-parse-csharp`;
 * `java` runs the command line of the file's `java` block, which runs the
 * Noesis Maven or Gradle plugin the repository's build declares.
 */
export const ParserName = z.enum(['csharp', 'java']);
export type ParserName = z.infer<typeof ParserName>;

/**
 * How the `java` parser runs the repository's own build. `command` is
 * the whole command line, run from the repository root; `{out}`, `{root}` and
 * `{name}` in an argument stand for the output directory, the repository root
 * and the repository name. The tool must leave a `code-model/<language>/`
 * tree under `{out}`.
 */
export const JavaParserSettings = z.object({
  command: z.array(z.string()).min(1),
  /** What to tell someone on whose machine the command cannot be started. */
  installHint: z.string().optional(),
});
export type JavaParserSettings = z.infer<typeof JavaParserSettings>;

/** `.noesis/settings.json`: which parser reads the repository, how, and how its namespaces map to modules. */
export interface RepositorySettings {
  readonly parser: ParserName;
  /** Null when the file has no `java` block. */
  readonly java: JavaParserSettings | null;
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
