import { CodeModelScanner, fillCommand } from './code-model-scanner';
import type { CodeModelScannerDeps } from './code-model-scanner';
import { loadNoesisConfig, noCodeModelCommand } from './noesis-config';

export type ConfiguredCodeModelScannerDeps = Omit<
  CodeModelScannerDeps,
  'command'
>;

/**
 * The `code-model` scanner: runs the command line the repository's
 * `noesis-config.json` gives in its `codeModel` block (a Gradle build's
 * `noesisScan` task, a Maven invocation, any tool that writes the code model)
 * and projects what it wrote. A new tool is a new config file, not a new
 * adapter; the presets (`java-maven`, `csharp`) are fixed command lines of
 * the same shape.
 */
export class ConfiguredCodeModelScanner extends CodeModelScanner {
  private installHintFromConfig: string | undefined;

  constructor({ noesis, now }: ConfiguredCodeModelScannerDeps) {
    super(noesis, now, 'code-model');
  }

  /** Read at every scan, with the rest of the file, so a changed command counts without a restart. */
  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    const { codeModel } = await loadNoesisConfig(root);
    if (codeModel === null) throw noCodeModelCommand(root);
    this.installHintFromConfig = codeModel.installHint;
    return fillCommand(codeModel.command, { out: outDir, root, name });
  }

  protected override installHint(): string {
    return (
      this.installHintFromConfig ??
      'Install the tool the "codeModel" command of noesis-config.json names, so that it runs from the repository root.'
    );
  }
}
