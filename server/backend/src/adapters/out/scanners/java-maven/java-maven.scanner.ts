import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CodeModelScanner,
  type CodeModelScannerDeps,
} from '../code-model-scanner';

/** Maven on the PATH of the machine the server runs on; a repository's own `mvnw` is preferred. */
const DEFAULT_COMMAND = ['mvn'];
const WRAPPER = 'mvnw';
/** The plugin built and installed from scanners/java; pinned, because an unversioned prefix would take whatever is newest locally. */
export const JAVA_SCANNER_PLUGIN_VERSION = '0.1.0-SNAPSHOT';
const SCAN_GOAL = `vision.noesis:noesis-scanner-maven-plugin:${JAVA_SCANNER_PLUGIN_VERSION}:scan`;

export type JavaScannerEngine = 'source' | 'bytecode' | 'hybrid';

export interface JavaMavenScannerDeps extends CodeModelScannerDeps {
  /** `source` (javac over the sources) unless given; `bytecode` for projects whose sources need annotation processors. */
  engine?: JavaScannerEngine;
}

/**
 * The Java scanner for Maven builds: the `noesis:scan` plugin (scanners/java)
 * runs inside the repository's own build, after `process-classes` so every
 * module is compiled, and writes the code model; the projection turns it into
 * the system model by the vision.noesis.annotations vocabulary.
 */
export class JavaMavenSourceCodeScanner extends CodeModelScanner {
  private readonly engine: JavaScannerEngine;
  private readonly command: readonly string[] | undefined;

  constructor({
    noesis,
    now,
    command,
    engine = 'source',
  }: JavaMavenScannerDeps) {
    super(noesis, now, 'java-maven');
    this.engine = engine;
    this.command = command;
  }

  /** The configured command, else the repository's Maven wrapper when it has one, else `mvn`. */
  private async commandFor(root: string): Promise<readonly string[]> {
    if (this.command !== undefined) return this.command;
    const wrapper = join(root, WRAPPER);
    try {
      await access(wrapper, constants.X_OK);
      return [wrapper];
    } catch {
      return DEFAULT_COMMAND;
    }
  }

  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    return [
      ...(await this.commandFor(root)),
      '-B',
      '-q',
      '-ntp',
      `-Dnoesis.out=${outDir}`,
      `-Dnoesis.repositoryRoot=${root}`,
      `-Dnoesis.repository=${name}`,
      `-Dnoesis.engine=${this.engine}`,
      'process-classes',
      SCAN_GOAL,
    ];
  }

  protected override installHint(): string {
    return 'Install Maven on the PATH and the Noesis plugin (`mvn install` in scanners/java), and run the service on a JDK.';
  }
}
