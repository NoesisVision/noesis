using Noesis.Scanner.Cli;
using Noesis.Scanner.CSharp;

ParsedCommandLine parsed;
try
{
    parsed = CommandLine.Parse(args, Directory.GetCurrentDirectory());
}
catch (CommandLineException exception)
{
    Console.Error.WriteLine(exception.Message);
    Console.Error.WriteLine(CommandLine.Usage);
    return (int)ScanExitCode.InvalidArguments;
}

if (parsed.ShowHelp || parsed.Request is null)
{
    Console.Out.WriteLine(CommandLine.Usage);
    return (int)ScanExitCode.Success;
}

var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};
var log = new ScanLog(parsed.Verbosity, Console.Error);
var result = await CSharpScanner.ScanAsync(parsed.Request, log, cancellation.Token);
log.Info($"Wrote {result.Models.Count} model file(s) to {result.ManifestPath}");
return (int)result.ExitCode;