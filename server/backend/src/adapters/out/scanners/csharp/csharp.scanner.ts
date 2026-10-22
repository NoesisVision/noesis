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
  private readonly command: readonly string[];

  constructor({ noesis, now, command = DEFAULT_COMMAND }: CSharpScannerDeps) {
    super(noesis, now, 'csharp');
    this.command = command;
  }

  protected override async firstStage(
    root: string,
    name: string,
    outDir: string,
  ): Promise<readonly string[]> {
    return [
      ...this.command,
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
