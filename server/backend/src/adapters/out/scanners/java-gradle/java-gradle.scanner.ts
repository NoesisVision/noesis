import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

const INIT_SCRIPT = 'noesis-scan.init.gradle';

/**
 * Applies the `vision.noesis.scanner` plugin to a build that does not apply
 * it itself, once every project is configured; a build that does keeps its
 * own, so the plugin is never applied twice from two class loaders. The
 * plugin and its core come from the local Maven repository.
 */
export const initScript = (
  version: string,
): string => `// Written by the Noesis service for one scan; regenerated every time.
initscript {
    repositories {
        mavenLocal()
        mavenCentral()
    }
    dependencies {
        classpath 'vision.noesis:noesis-scanner-gradle-plugin:${version}'
    }
}

gradle.projectsEvaluated {
    def root = gradle.rootProject
    if (root.tasks.findByName('noesisScan') == null) {
        root.pluginManager.apply(vision.noesis.scanner.gradle.NoesisScannerPlugin)
    }
}
`;

export interface JavaGradleScannerDeps extends CodeModelScannerDeps {
  /** The engine `.noesis/settings.json` names; `source` unless given. */
  engine?: JavaScannerEngine;
}

/**
 * The Java scanner for Gradle builds: the `noesisScan` task of the
 * vision.noesis.scanner plugin (scanners/java/gradle-plugin), applied through
 * an init script when the build does not apply it, so any Gradle build with
 * Java projects scans without a change to its files.
 */
export class JavaGradleSourceCodeScanner extends CodeModelScanner {
  private readonly engine: JavaScannerEngine | undefined;
  private readonly command: readonly string[] | undefined;

  constructor({
    noesis,
    now,
    namespaces,
    command,
    engine,
  }: JavaGradleScannerDeps) {
    super(noesis, now, namespaces, 'java-gradle');
    this.engine = engine;
    this.command = command;
  }

  /** The repository's `gradlew` when it has one, else `gradle`, unless a command is given. */
  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    await mkdir(outDir, { recursive: true });
    const script = join(outDir, INIT_SCRIPT);
    await writeFile(script, initScript(JAVA_SCANNER_PLUGIN_VERSION));
    return [
      ...(this.command ?? (await wrapperOr(root, 'gradlew', 'gradle'))),
      '-q',
      '--init-script',
      script,
      'noesisScan',
      `-Pnoesis.out=${outDir}`,
      `-Pnoesis.repositoryRoot=${root}`,
      `-Pnoesis.repository=${name}`,
      `-Pnoesis.engine=${javaEngine(this.engine)}`,
    ];
  }

  protected override installHint(): string {
    return 'Install Gradle on the PATH or give the repository a gradlew, publish the Noesis Gradle plugin (`mvn install` in scanners/java, then `./gradlew publishToMavenLocal` in scanners/java/gradle-plugin), and run the service on a JDK.';
  }
}
