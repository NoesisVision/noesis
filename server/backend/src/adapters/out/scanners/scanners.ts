import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { ScannerName } from '#backend/platform/config/config';
import { CSharpSourceCodeScanner } from './csharp/csharp.scanner';
import { type DummyScannerDeps, DummySourceCodeScanner } from './dummy.scanner';
import { JavaSourceCodeScanner } from './java.scanner';

const SCANNERS: Record<
  ScannerName,
  (deps: DummyScannerDeps) => SourceCodeScanner
> = {
  java: (deps) => new JavaSourceCodeScanner(deps),
  csharp: (deps) => new CSharpSourceCodeScanner(deps),
  dummy: (deps) => new DummySourceCodeScanner(deps),
};

/**
 * `deps` is what the dummy scanner replays design documents from; the Java
 * and C# scanners take the repository root and the clock from it.
 */
export function createScanner(
  name: ScannerName,
  deps: DummyScannerDeps,
): SourceCodeScanner {
  return SCANNERS[name](deps);
}
