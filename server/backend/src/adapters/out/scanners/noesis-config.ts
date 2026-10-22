import { join } from 'node:path';
import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

const CONFIG_FILE = 'noesis-config.json';

/** `.noesis/noesis-config.json`: the repository's scanner settings live with its knowledge graph. */
function noesisConfigPath(repositoryRoot: string): string {
  return new NoesisDir(repositoryRoot).resolve(CONFIG_FILE);
}

/**
 * The scanners a repository can name: `code-model` runs the command line of
 * its `codeModel` block, `java`, `java-maven` and `csharp` are built-in
 * presets of it, and `dummy` reads no code: it replays the implemented
 * design documents, for a repository that has no code to scan yet.
 */
export const RepositoryScannerName = z.enum([
  'java',
  'java-maven',
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
const CodeModelToolConfig = z.object({
  command: z.array(z.string()).min(1),
  /** What to tell someone on whose machine the command cannot be started. */
  installHint: z.string().optional(),
});
type CodeModelToolConfig = z.infer<typeof CodeModelToolConfig>;

/**
 * `.noesis/noesis-config.json`: which scanner reads the repository, how, and
 * how its namespaces map to modules.
 */
const NoesisConfigSchema = NamespaceConfigSchema.extend({
  scanner: RepositoryScannerName.optional(),
  codeModel: CodeModelToolConfig.optional(),
});

export interface NoesisConfig {
  /** Null when the file names none, or there is no file. */
  readonly scanner: RepositoryScannerName | null;
  /** Null when the file has no `codeModel` block. */
  readonly codeModel: CodeModelToolConfig | null;
  readonly namespaces: NamespaceConfig;
}

/** Reads the file; no file names no scanner and maps every namespace to itself. */
export async function loadNoesisConfig(
  repositoryRoot: string,
): Promise<NoesisConfig> {
  const path = noesisConfigPath(repositoryRoot);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    // The file used to sit at the repository root; one left there is a mistake worth naming.
    if (await Bun.file(join(repositoryRoot, CONFIG_FILE)).exists()) {
      throw new Error(
        `${CONFIG_FILE} belongs in the .noesis directory now: move ${join(repositoryRoot, CONFIG_FILE)} to ${path}.`,
      );
    }
    return {
      scanner: null,
      codeModel: null,
      namespaces: NamespaceConfig.of({}),
    };
  }
  const parsed = NoesisConfigSchema.safeParse(await file.json());
  if (!parsed.success) {
    throw new Error(
      `Invalid ${CONFIG_FILE}:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const { scanner, codeModel, ...namespaces } = parsed.data;
  return {
    scanner: scanner ?? null,
    codeModel: codeModel ?? null,
    namespaces: NamespaceConfig.of(namespaces),
  };
}

/** What a scan needs when the repository names no scanner. */
export function noScannerConfigured(repositoryRoot: string): Error {
  return new Error(
    `${noesisConfigPath(repositoryRoot)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
  );
}

/** What the `code-model` scanner needs when the repository gives it no command. */
export function noCodeModelCommand(repositoryRoot: string): Error {
  return new Error(
    `${noesisConfigPath(repositoryRoot)} names the code-model scanner but has no "codeModel": { "command": [...] } telling it what to run.`,
  );
}
