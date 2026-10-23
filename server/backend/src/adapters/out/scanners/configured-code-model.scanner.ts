import type { CodeModelToolSettings } from '#backend/app/system-model/scanner-settings.repository';
import { CodeModelScanner, fillCommand } from './code-model-scanner';
import type { CodeModelScannerDeps } from './code-model-scanner';

export interface ConfiguredCodeModelScannerDeps extends Omit<
  CodeModelScannerDeps,
  'command'
> {
  /** The `codeModel` block of `.noesis/settings.json`; null when it has none. */
  codeModel: CodeModelToolSettings | null;
}

/**
 * The `code-model` scanner: runs the command line the repository's
 * `.noesis/settings.json` gives in its `codeModel` block (a Gradle build's
 * `noesisScan` task, a Maven invocation, any tool that writes the code model)
 * and projects what it wrote. A new tool is a new settings file, not a new
 * adapter; the presets (`java-maven`, `java-gradle`, `csharp`) are fixed
 * command lines of the same shape.
 */
export class ConfiguredCodeModelScanner extends CodeModelScanner {
  private readonly codeModel: CodeModelToolSettings | null;

  constructor({
    noesis,
    now,
    namespaces,
    codeModel,
  }: ConfiguredCodeModelScannerDeps) {
    super(noesis, now, namespaces, 'code-model');
    this.codeModel = codeModel;
  }

  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    if (this.codeModel === null) {
      throw new Error(
        '.noesis/settings.json names the code-model scanner but has no "codeModel": { "command": [...] } telling it what to run.',
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
