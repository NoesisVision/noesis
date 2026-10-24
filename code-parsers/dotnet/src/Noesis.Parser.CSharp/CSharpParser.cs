using System.Reflection;
using Noesis.Parser.CSharp.Caching;
using Noesis.Parser.CSharp.Loading;
using Noesis.Parser.Model;
using Diagnostic = Noesis.Parser.Model.Diagnostic;
using DiagnosticSource = Noesis.Parser.Model.DiagnosticSource;
using DiagnosticSeverity = Noesis.Parser.Model.DiagnosticSeverity;

namespace Noesis.Parser.CSharp;

/// <summary>Parses one solution with Roslyn into the common code model: one manifest, one model file per project.</summary>
public static class CSharpParser
{
    public static readonly Generator Generator = new("noesis-parse-csharp", InformationalVersion());

    public static async Task<ParseResult> ParseAsync(ParseRequest request, ParseLog log, CancellationToken cancellationToken = default)
    {
        var manifestDiagnostics = new List<Diagnostic>();
        var artifacts = new List<ManifestArtifact>();
        var models = new List<CodeModelFile>();
        var cached = new List<NodeId>();
        var loaded = 0;
        var cache = new ModelCache(request.CacheDirectory, log);
        try
        {
            using var solution = await new SolutionLoader(request, log).LoadAsync(cancellationToken);
            manifestDiagnostics.AddRange(solution.SolutionProblems);
            if (solution.Projects.Count == 0)
                manifestDiagnostics.Add(ParserError($"No C# project found under {string.Join(", ", request.Inputs)}."));
            var sourceAssemblies = solution.Projects.Select(project => project.AssemblyName).ToHashSet(StringComparer.Ordinal);
            var keys = new CacheKeys(request, sourceAssemblies, solution.ProblemsOf);
            var parser = new ArtifactParser(Generator, request.RepositoryRoot, sourceAssemblies, cache, keys, log);
            var stems = new FileStems();
            foreach (var project in solution.Projects)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var stem = stems.Next(project.AssemblyName);
                var parsed = await parser.ParseAsync(project, stem, solution.ProblemsOf(project), cancellationToken);
                artifacts.Add(new ManifestArtifact(parsed.Model.Artifact.Id, CodeModelWriter.ArtifactFile(Language.CSharp, stem)));
                models.Add(parsed.Model);
                if (parsed.Loaded) loaded++;
                if (parsed.Cached) cached.Add(parsed.Model.Artifact.Id);
            }
            if (cache.Enabled && request.Projects.Count == 0 && request.ExcludeProjects.Count == 0) cache.Sweep(stems.Used);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            manifestDiagnostics.Add(ParserError(exception.Message));
            log.Warn(exception.ToString());
        }

        var manifest = new ParseManifest(
            ParseManifest.CurrentSchemaVersion,
            Generator,
            Language.CSharp,
            new RepositoryInfo(request.RepositoryName, request.Revision),
            Root(request),
            artifacts,
            manifestDiagnostics);
        await CodeModelWriter.WriteAsync(request.OutputDirectory, manifest, models, cancellationToken);
        if (cache.Enabled) log.Info($"Cache: {cached.Count} of {models.Count} model(s) reused from {request.CacheDirectory}");
        var exitCode = loaded > 0 ? ParseExitCode.Success : ParseExitCode.NothingLoaded;
        return new ParseResult(manifest, models, request.OutputDirectory, exitCode, cached);
    }

    private static Diagnostic ParserError(string message) =>
        new(DiagnosticSeverity.Error, "NS1001", message, null, DiagnosticSource.Parser);

    /// <summary>The inputs relative to the repository root, `;`-joined when several were given.</summary>
    private static string Root(ParseRequest request)
    {
        var relative = request.Inputs.Select(input =>
        {
            var path = Path.GetRelativePath(request.RepositoryRoot, Path.GetFullPath(input));
            return (path == "." ? "" : path).Replace('\\', '/');
        });
        return string.Join(";", relative);
    }

    /// <summary>One file per model, named after the assembly; a second assembly of the same name gets `~2`. The cache directories carry the same names.</summary>
    private sealed class FileStems
    {
        private readonly HashSet<string> _used = new(StringComparer.OrdinalIgnoreCase);

        public IReadOnlySet<string> Used => _used;

        public string Next(string assemblyName)
        {
            var name = CodeModelWriter.ArtifactFileStem(assemblyName);
            var candidate = name;
            for (var i = 2; !_used.Add(candidate); i++) candidate = $"{name}~{i}";
            return candidate;
        }
    }

    private static string InformationalVersion()
    {
        var version = typeof(CSharpParser).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return version?.Split('+')[0] ?? "0.0.0";
    }
}
