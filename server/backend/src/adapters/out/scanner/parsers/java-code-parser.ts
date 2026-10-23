import type { CodeModelToolSettings } from '#backend/app/scanner/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { CommandCodeParser, fillCommand } from './command-code-parser';

export interface JavaCodeParserDeps {
  noesis: NoesisDir;
  /** The `codeModel` block of `.noesis/settings.json`; null when it has none. */
  codeModel: CodeModelToolSettings | null;
}

/**
 * The `code-model` parser: runs the command line the
 * repository's `.noesis/settings.json` gives in its `codeModel` block (a
 * Gradle build's `noesisParse` task, a Maven invocation, any tool that writes
 * the code model). A new tool is a new settings file, not a new adapter; the
 * `csharp` preset is a fixed command line of the same shape. A Java
 * repository declares the Noesis Maven or Gradle plugin in its build and
 * gives the command that runs it here.
 */
export class JavaCodeParser extends CommandCodeParser {
  private readonly codeModel: CodeModelToolSettings | null;

  constructor({ noesis, codeModel }: JavaCodeParserDeps) {
    super(noesis, 'code-model');
    this.codeModel = codeModel;
  }

  protected override async commandLine(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    if (this.codeModel === null) {
      throw new Error(
        '.noesis/settings.json names the code-model parser but has no "codeModel": { "command": [...] } telling it what to run.',
      );
    }
    return fillCommand(this.codeModel.command, { out: outDir, root, name });
  }

  protected override installHint(): string {
    return (
      this.codeModel?.installHint ??
      'Install the tool the "codeModel" command of .noesis/settings.json names, so that it runs from the repository root.'
    );
  }
}
