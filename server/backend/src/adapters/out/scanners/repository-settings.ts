import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

const SETTINGS_FILE = 'settings.json';

/**
 * The scanners a repository can name: `code-model` runs the command line of
 * its `codeModel` block, `java-maven`, `java-gradle` and `csharp` are built-in
 * presets of it, `java` is the regex Java scanner, and `dummy` reads no code:
 * it replays the implemented design documents, for a repository that has no
 * code to scan yet.
 */
export const RepositoryScannerName = z.enum([
  'java',
  'java-maven',
  'java-gradle',
  'csharp',
  'code-model',
  'dummy',
]);
export type RepositoryScannerName = z.infer<typeof RepositoryScannerName>;

/**
 * How the `code-model` scanner runs the repository's own tool. `command` is
 * the whole command line, run from the repository root; `{out}`, `{root}` and
 * `{name}` in an argument stand for the output directory, the repository root
 * and the repository name. The tool must leave a `code-model/<language>/`
 * tree under `{out}`.
 */
const CodeModelToolSettings = z.object({
  command: z.array(z.string()).min(1),
  /** What to tell someone on whose machine the command cannot be started. */
  installHint: z.string().optional(),
});
export type CodeModelToolSettings = z.infer<typeof CodeModelToolSettings>;

/**
 * Which engine of the Java scanner the `java-maven` and `java-gradle`
 * presets run: `source` (javac over the sources), `bytecode` (the compiled
 * classes) or `hybrid` (the sources, plus what an annotation processor such
 * as Lombok generated, from the classes).
 */
export const JavaScannerEngine = z.enum(['source', 'bytecode', 'hybrid']);
export type JavaScannerEngine = z.infer<typeof JavaScannerEngine>;

/**
 * `.noesis/settings.json` in the repository: which scanner reads the
 * repository, how, and how its namespaces map to modules.
 */
const RepositorySettingsSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
  codeModel: CodeModelToolSettings.optional(),
  engine: JavaScannerEngine.optional(),
});

export interface RepositorySettings {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  /** Null when the file has no `codeModel` block. */
  readonly codeModel: CodeModelToolSettings | null;
  /** Null when the file names none; the Java presets then run the source engine. */
  readonly engine: JavaScannerEngine | null;
  readonly namespaces: NamespaceConfig;
}

/** Where the settings live: `.noesis/settings.json`. */
export function repositorySettingsPath(noesis: NoesisDir): string {
  return noesis.resolve(SETTINGS_FILE);
}

/** Reads the file; no file names no scanner and maps every namespace to itself. */
export async function loadRepositorySettings(
  noesis: NoesisDir,
): Promise<RepositorySettings> {
  const file = Bun.file(repositorySettingsPath(noesis));
  if (!(await file.exists())) {
    return {
      scanner: null,
      codeModel: null,
      engine: null,
      namespaces: NamespaceConfig.of({}),
    };
  }
  const parsed = RepositorySettingsSchema.safeParse(await file.json());
  if (!parsed.success) {
    throw new Error(`Invalid ${file.name}:\n${z.prettifyError(parsed.error)}`);
  }
  const { scanner, codeModel, engine, ...namespaces } = parsed.data;
  if (
    engine !== undefined &&
    scanner !== 'java-maven' &&
    scanner !== 'java-gradle'
  ) {
    throw new Error(
      `${file.name} sets "engine", which only the java-maven and java-gradle scanners read; with "code-model" put -Dnoesis.engine or -Pnoesis.engine in the command.`,
    );
  }
  return {
    scanner: scanner ?? null,
    codeModel: codeModel ?? null,
    engine: engine ?? null,
    namespaces: NamespaceConfig.of(namespaces),
  };
}

/** What the `code-model` scanner needs when the repository gives it no command. */
export function noCodeModelCommand(noesis: NoesisDir): Error {
  return new Error(
    `${repositorySettingsPath(noesis)} names the code-model scanner but has no "codeModel": { "command": [...] } telling it what to run.`,
  );
}
