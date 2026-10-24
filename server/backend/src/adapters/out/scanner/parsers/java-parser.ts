import type { JavaParserSettings } from '#backend/app/scanner/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { CommandCodeParser, fillCommand } from './command-code-parser';

export interface JavaParserDeps {
  noesis: NoesisDir;
  /** The `parser` of `.noesis/settings.json`. */
  settings: JavaParserSettings;
}

/**
 * The Java parser: runs the command line the repository's
 * `.noesis/settings.json` gives in its `parser` (a Gradle build's
 * `noesisParse` task, or a Maven invocation of `noesis:parse`). A Java
 * repository declares the Noesis Maven or Gradle plugin in its build, so the
 * command comes from the repository, not the service.
 */
export class JavaParser extends CommandCodeParser {
  private readonly settings: JavaParserSettings;

  constructor({ noesis, settings }: JavaParserDeps) {
    super(noesis, 'java');
    this.settings = settings;
  }

  protected override async commandLine(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    return fillCommand(this.settings.command, { out: outDir, root, name });
  }

  protected override installHint(): string {
    return (
      this.settings.installHint ??
      'Install the tool the "command" of .noesis/settings.json names, so that it runs from the repository root.'
    );
  }
}
