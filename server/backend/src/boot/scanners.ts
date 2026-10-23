import { ConfiguredCodeModelScanner } from '#backend/adapters/out/scanners/configured-code-model.scanner';
import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import type { Now } from '#backend/app/clock';
import type { ScannerBuilders } from '#backend/app/system-model/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The scanners `.noesis/settings.json` can name, each built from the settings it reads. */
export function scannerBuilders(noesis: NoesisDir, now: Now): ScannerBuilders {
  return {
    csharp: ({ namespaces }) =>
      new CSharpSourceCodeScanner({ noesis, now, namespaces }),
    'code-model': ({ namespaces, codeModel }) =>
      new ConfiguredCodeModelScanner({ noesis, now, namespaces, codeModel }),
  };
}
