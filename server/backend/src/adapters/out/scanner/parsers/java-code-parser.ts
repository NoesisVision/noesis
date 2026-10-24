import type { JavaParserSettings } from '#backend/app/scanner/scanner-settings.repository';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { CommandCodeParser, fillCommand } from './command-code-parser';

export interface JavaCodeParserDeps {
  noesis: NoesisDir;
  /** The `java` block of `.noesis/settings.json`; null when it has none. */
  settings: JavaParserSettings | null;
}

/**
 * The Java parser: runs the command line the repository's
 * `.noesis/settings.json` gives in its `java` block (a Gradle build's
 * `noesisParse` task, or a Maven invocation of `noesis:parse`). A Java
 * repository declares the Noesis Maven or Gradle plugin in its build, so the
 * command comes from the repository, not the service.
 */
export class JavaCodeParser extends CommandCodeParser {
  private readonly settings: JavaParserSettings | null;

  constructor({ noesis, settings }: JavaCodeParserDeps) {
    super(noesis, 'java');
    this.settings = settings;
  }

  protected override async commandLine(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    if (this.settings === null) {
      throw new Error(
        '.noesis/settings.json names the java parser but has no "java": { "command": [...] } telling it what to run.',
      );
    }
    return fillCommand(this.settings.command, { out: outDir, root, name });
  }

  protected override installHint(): string {
    return (
      this.settings?.installHint ??
      'Install the tool the "java" command of .noesis/settings.json names, so that it runs from the repository root.'
    );
  }
}
