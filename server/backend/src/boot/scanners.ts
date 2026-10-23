import { ConfiguredCodeModelScanner } from '#backend/adapters/out/scanners/configured-code-model.scanner';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import { JavaGradleSourceCodeScanner } from '#backend/adapters/out/scanners/java-gradle/java-gradle.scanner';
import { JavaMavenSourceCodeScanner } from '#backend/adapters/out/scanners/java-maven/java-maven.scanner';
import type { Now } from '#backend/app/clock';
import type { ScannerBuilders } from '#backend/app/system-model/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The scanners `.noesis/settings.json` can name, each built from the settings it reads. */
export function scannerBuilders(noesis: NoesisDir, now: Now): ScannerBuilders {
  return {
    'java-maven': ({ namespaces, engine }) =>
      new JavaMavenSourceCodeScanner({
        noesis,
        now,
        namespaces,
        engine: engine ?? undefined,
      }),
    'java-gradle': ({ namespaces, engine }) =>
      new JavaGradleSourceCodeScanner({
        noesis,
        now,
        namespaces,
        engine: engine ?? undefined,
      }),
    csharp: ({ namespaces }) =>
      new CSharpSourceCodeScanner({ noesis, now, namespaces }),
    'code-model': ({ namespaces, codeModel }) =>
      new ConfiguredCodeModelScanner({ noesis, now, namespaces, codeModel }),
  };
}
