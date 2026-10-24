import { z } from 'zod';
import type { NamespaceConfig } from '#backend/app/scanners/system-model-builders/namespace-config';

/** The `csharp` parser: runs `noesis-parse-csharp`, which needs no settings. */
const CSharpParserSettings = z.strictObject({
  language: z.literal('csharp'),
});

/**
 * The `java` parser: runs the repository's own build, which declares the
 * Noesis Maven or Gradle plugin. `command` is the whole command line, run
 * from the repository root; `{out}`, `{root}` and `{name}` in an argument
 * stand for the output directory, the repository root and the repository
 * name. The build must leave a `code-model/java/` tree under `{out}`.
 */
export const JavaParserSettings = z.strictObject({
  language: z.literal('java'),
  command: z.array(z.string()).min(1),
  /** What to tell someone on whose machine the command cannot be started. */
  installHint: z.string().optional(),
});
export type JavaParserSettings = z.infer<typeof JavaParserSettings>;

/** The parser a repository names, by its language, with that parser's settings. */
export const CodeParserSettings = z.discriminatedUnion('language', [
  CSharpParserSettings,
  JavaParserSettings,
]);
export type CodeParserSettings = z.infer<typeof CodeParserSettings>;

/** `.noesis/settings.json`: which parser reads the repository, how, and how its namespaces map to modules. */
export interface RepositorySettings {
  readonly parser: CodeParserSettings;
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
