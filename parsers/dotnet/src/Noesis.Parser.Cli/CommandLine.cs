using Noesis.Parser.CSharp;

namespace Noesis.Parser.Cli;

/// <summary>Parses `noesis-parse-csharp &lt;path&gt;... [options]` into a <see cref="ParseRequest"/>.</summary>
public static class CommandLine
{
    public const string Usage = """
        noesis-parse-csharp <path>...                  directory, solution or project(s)
          --out <dir>                                 output root (default `<repository-root>/.noesis/tmp/parser`)
          --repository <name> --revision <commit>     written into the manifest
          --repository-root <dir>                     directory file paths are relative to (default: current directory)
          --configuration Debug|Release               MSBuild configuration (default Debug)
          --projects <glob,...>                       only these projects (by project name)
          --exclude-projects <glob,...>               skip these projects
          --tfm <moniker>                             target framework for multi-targeted projects (default: highest)
          --no-restore                                never run dotnet restore
          --cache <dir>                               reuse the model of every project whose inputs did not change (default: no cache)
          --verbosity quiet|normal|detailed
        """;

    public static ParsedCommandLine Parse(IReadOnlyList<string> args, string currentDirectory)
    {
        var inputs = new List<string>();
        string? output = null;
        var repository = "";
        var revision = "";
        var repositoryRoot = currentDirectory;
        var configuration = "Debug";
        var projects = Array.Empty<string>();
        var excludeProjects = Array.Empty<string>();
        string? tfm = null;
        var noRestore = false;
        string? cache = null;
        var verbosity = Verbosity.Normal;

        for (var i = 0; i < args.Count; i++)
        {
            var arg = args[i];
            switch (arg)
            {
                case "--out": output = Next(); break;
                case "--repository": repository = Next(); break;
                case "--revision": revision = Next(); break;
                case "--repository-root": repositoryRoot = Next(); break;
                case "--configuration": configuration = Next(); break;
                case "--projects": projects = Globs(Next()); break;
                case "--exclude-projects": excludeProjects = Globs(Next()); break;
                case "--tfm": tfm = Next(); break;
                case "--no-restore": noRestore = true; break;
                case "--cache": cache = Next(); break;
                case "--verbosity":
                    verbosity = Next().ToLowerInvariant() switch
                    {
                        "quiet" => Verbosity.Quiet,
                        "normal" => Verbosity.Normal,
                        "detailed" => Verbosity.Detailed,
                        var other => throw new CommandLineException($"Unknown verbosity '{other}'."),
                    };
                    break;
                case "--help" or "-h": return new ParsedCommandLine(null, verbosity, ShowHelp: true);
                default:
                    if (arg.StartsWith("--", StringComparison.Ordinal)) throw new CommandLineException($"Unknown option {arg}.");
                    inputs.Add(arg);
                    break;
            }

            continue;

            string Next() => i + 1 >= args.Count 
                ? throw new CommandLineException($"Option {arg} needs a value.") 
                : args[++i];
        }
        if (inputs.Count == 0) throw new CommandLineException("A path to parse is required.");

        var root = Path.GetFullPath(repositoryRoot, currentDirectory);
        var request = new ParseRequest
        {
            Inputs = inputs.Select(input => Path.GetFullPath(input, currentDirectory)).ToArray(),
            RepositoryRoot = root,
            OutputDirectory = output is null ? Path.Combine(root, ".noesis", "tmp", "parser") : Path.GetFullPath(output, currentDirectory),
            RepositoryName = repository,
            Revision = revision,
            Configuration = configuration,
            Projects = projects,
            ExcludeProjects = excludeProjects,
            TargetFramework = tfm,
            NoRestore = noRestore,
            CacheDirectory = cache is null ? null : Path.GetFullPath(cache, currentDirectory),
        };
        return new ParsedCommandLine(request, verbosity, ShowHelp: false);
    }

    private static string[] Globs(string value) =>
        value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}