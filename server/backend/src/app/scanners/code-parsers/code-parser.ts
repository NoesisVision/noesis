import type { CodeModelFile, ParseManifest } from './code-model';

/** The code model of one repository: the manifest and every file it lists. */
export interface ParsedCode {
  readonly manifest: ParseManifest;
  readonly files: readonly CodeModelFile[];
}

/**
 * Reads the repository's source code into the code model: the first stage of
 * a scan. A parser knows its language's tooling and nothing of the system
 * model.
 */
export interface CodeParser {
  parse(): Promise<ParsedCode>;
}
