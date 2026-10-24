using Noesis.Parser.Cli;
using Noesis.Parser.CSharp;

ParsedCommandLine parsed;
try
{
    parsed = CommandLine.Parse(args, Directory.GetCurrentDirectory());
}
catch (CommandLineException exception)
{
    Console.Error.WriteLine(exception.Message);
    Console.Error.WriteLine(CommandLine.Usage);
    return (int)ParseExitCode.InvalidArguments;
}

if (parsed.ShowHelp || parsed.Request is null)
{
    Console.Out.WriteLine(CommandLine.Usage);
    return (int)ParseExitCode.Success;
}

var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};
var log = new ParseLog(parsed.Verbosity, Console.Error);
var result = await CSharpParser.ParseAsync(parsed.Request, log, cancellation.Token);
log.Info($"Wrote {result.Models.Count} model file(s) to {result.ManifestPath}");
return (int)result.ExitCode;