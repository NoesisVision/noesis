import {
  CodeModelScanner,
  type CodeModelScannerDeps,
} from '../code-model-scanner';

/** The `dotnet tool`, on the PATH of the machine the server runs on. */
const DEFAULT_COMMAND = ['noesis-scan-csharp'];
/** Under `.noesis/`: the tool's model cache, a ring per project; scanners/dotnet/README.md. */
const CACHE_DIR = ['cache', 'scanner', 'csharp'] as const;

export type CSharpScannerDeps = CodeModelScannerDeps;

/**
 * The C# scanner: `noesis-scan-csharp` (scanners/dotnet) reads the solution
 * with Roslyn and writes the code model, reusing the cached model of every
 * project whose inputs did not change (`.noesis/cache/scanner/csharp/`); the
 * projection turns it into the system model by the NoesisVision.Annotations
 * vocabulary. The cache in scanners/dotnet/README.md.
 */
export class CSharpSourceCodeScanner extends CodeModelScanner {
  private readonly command: readonly string[];

  constructor({
    noesis,
    now,
    namespaces,
    command = DEFAULT_COMMAND,
  }: CSharpScannerDeps) {
    super(noesis, now, namespaces, 'csharp');
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
      '--cache',
      this.noesis.resolve(...CACHE_DIR),
    ];
  }

  protected override installHint(): string {
    return 'Install the .NET scanner (scanners/dotnet, `dotnet tool install`) so that it is on the PATH.';
  }
}
