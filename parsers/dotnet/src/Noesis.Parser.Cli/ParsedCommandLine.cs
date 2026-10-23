using Noesis.Parser.CSharp;

namespace Noesis.Parser.Cli;

public sealed record ParsedCommandLine(ParseRequest? Request, Verbosity Verbosity, bool ShowHelp);