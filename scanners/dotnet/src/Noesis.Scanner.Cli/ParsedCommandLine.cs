using Noesis.Scanner.CSharp;

namespace Noesis.Scanner.Cli;

public sealed record ParsedCommandLine(ScanRequest? Request, Verbosity Verbosity, bool ShowHelp);