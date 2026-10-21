import { CSHARP_VOCABULARY } from '#backend/app/code-model/projection/csharp.vocabulary';
import {
  CodeModelScanner,
  type CodeModelScannerDeps,
} from '../code-model-scanner';

/** The `dotnet tool`, on the PATH of the machine the server runs on. */
const DEFAULT_COMMAND = ['noesis-scan-csharp'];

export type CSharpScannerDeps = CodeModelScannerDeps;

/**
 * The C# scanner: `noesis-scan-csharp` (scanners/dotnet) reads the solution
 * with Roslyn and writes the code model, which the projection turns into the
 * system model by the NoesisVision.Annotations vocabulary.
 */
export class CSharpSourceCodeScanner extends CodeModelScanner {
  constructor({ noesis, now, command = DEFAULT_COMMAND }: CSharpScannerDeps) {
    super(noesis, now, command, 'csharp', CSHARP_VOCABULARY);
  }

  protected override firstStageArgs(
    root: string,
    name: string,
    outDir: string,
  ): readonly string[] {
    return [
      root,
      '--out',
      outDir,
      '--repository-root',
      root,
      '--repository',
      name,
    ];
  }

  protected override installHint(): string {
    return 'Install the .NET scanner (scanners/dotnet, `dotnet tool install`) so that it is on the PATH.';
  }
}
