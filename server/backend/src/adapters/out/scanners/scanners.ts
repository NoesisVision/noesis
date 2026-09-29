import type { SourceCodeScanner } from '#backend/app/system-model/source-code-scanner';
import type { ScannerName } from '#backend/platform/config/config';
import { CSharpSourceCodeScanner } from './csharp.scanner';
import { DummySourceCodeScanner } from './dummy.scanner';
import { JavaSourceCodeScanner } from './java.scanner';

const SCANNERS: Record<ScannerName, () => SourceCodeScanner> = {
  java: () => new JavaSourceCodeScanner(),
  csharp: () => new CSharpSourceCodeScanner(),
  dummy: () => new DummySourceCodeScanner(),
};

export function createScanner(name: ScannerName): SourceCodeScanner {
  return SCANNERS[name]();
}
