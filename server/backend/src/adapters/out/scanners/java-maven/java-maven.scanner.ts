import {
  CodeModelScanner,
  type CodeModelScannerDeps,
} from '../code-model-scanner';
import {
  JAVA_SCANNER_PLUGIN_VERSION,
  javaEngine,
  wrapperOr,
} from '../java-build';
import type { JavaScannerEngine } from '../repository-settings';

export { JAVA_SCANNER_PLUGIN_VERSION };

const SCAN_GOAL = `vision.noesis:noesis-scanner-maven-plugin:${JAVA_SCANNER_PLUGIN_VERSION}:scan`;

export interface JavaMavenScannerDeps extends CodeModelScannerDeps {
  /** The engine `.noesis/settings.json` names; `source` unless given. */
  engine?: JavaScannerEngine;
}

/**
 * The Java scanner for Maven builds: the `noesis:scan` plugin (scanners/java)
 * runs inside the repository's own build, after `process-classes` so every
 * module is compiled, and writes the code model; the projection turns it into
 * the system model by the vision.noesis.annotations vocabulary.
 */
export class JavaMavenSourceCodeScanner extends CodeModelScanner {
  private readonly engine: JavaScannerEngine | undefined;
  private readonly command: readonly string[] | undefined;

  constructor({
    noesis,
    now,
    namespaces,
    command,
    engine,
  }: JavaMavenScannerDeps) {
    super(noesis, now, namespaces, 'java-maven');
    this.engine = engine;
    this.command = command;
  }

  /** The repository's `mvnw` when it has one, else `mvn`, unless a command is given. */
  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    return [
      ...(this.command ?? (await wrapperOr(root, 'mvnw', 'mvn'))),
      '-B',
      '-q',
      '-ntp',
      `-Dnoesis.out=${outDir}`,
      `-Dnoesis.repositoryRoot=${root}`,
      `-Dnoesis.repository=${name}`,
      `-Dnoesis.engine=${javaEngine(this.engine)}`,
      'process-classes',
      SCAN_GOAL,
    ];
  }

  protected override installHint(): string {
    return 'Install Maven on the PATH and the Noesis plugin (`mvn install` in scanners/java), and run the service on a JDK.';
  }
}
