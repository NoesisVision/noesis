import { join } from 'node:path';
import { z } from 'zod';
import {
  NamespaceConfig,
  NamespaceConfigSchema,
} from '#backend/app/code-model/projection/namespace-config';

const CONFIG_FILE = 'noesis-config.json';

/**
 * The scanners a repository can name: `code-model` runs the command line of
 * its `codeModel` block, the others are built-in presets of it.
 */
export const RepositoryScannerName = z.enum([
  'java',
  'java-maven',
  'csharp',
  'code-model',
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
 * `noesis-config.json` at the repository root: which scanner reads the
 * repository, how, and how its namespaces map to modules.
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
  const file = Bun.file(join(repositoryRoot, CONFIG_FILE));
  if (!(await file.exists())) {
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
    `${join(repositoryRoot, CONFIG_FILE)} names no scanner. Set "scanner" to one of: ${RepositoryScannerName.options.join(', ')}.`,
  );
}

/** What the `code-model` scanner needs when the repository gives it no command. */
export function noCodeModelCommand(repositoryRoot: string): Error {
  return new Error(
    `${join(repositoryRoot, CONFIG_FILE)} names the code-model scanner but has no "codeModel": { "command": [...] } telling it what to run.`,
  );
}
