import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { CommandCodeParser } from './command-code-parser';

/** The `dotnet tool`, on the PATH of the machine the server runs on. */
const DEFAULT_COMMAND = ['noesis-parse-csharp'];
/** Under `.noesis/`: the tool's model cache, a ring per project; parsers/dotnet/README.md. */
const CACHE_DIR = ['cache', 'parser', 'csharp'] as const;

export interface CSharpParserDeps {
  noesis: NoesisDir;
  /** The tool's command and leading arguments; `noesis-parse-csharp` unless given. */
  command?: readonly string[];
}

/**
 * The C# parser: `noesis-parse-csharp` (parsers/dotnet) reads the solution
 * with Roslyn and writes the code model, reusing the cached model of every
 * project whose inputs did not change (`.noesis/cache/parser/csharp/`). The
 * cache in parsers/dotnet/README.md.
 */
export class CSharpParser extends CommandCodeParser {
  private readonly command: readonly string[];

  constructor({ noesis, command = DEFAULT_COMMAND }: CSharpParserDeps) {
    super(noesis, 'csharp');
    this.command = command;
  }

  protected override async commandLine(
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
    return 'Install the .NET parser (parsers/dotnet, `dotnet tool install`) so that it is on the PATH.';
  }
}
