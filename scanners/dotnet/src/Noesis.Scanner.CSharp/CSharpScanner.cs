using System.Reflection;
using Noesis.Scanner.CSharp.Caching;
using Noesis.Scanner.CSharp.Loading;
using Noesis.Scanner.Model;
using Diagnostic = Noesis.Scanner.Model.Diagnostic;
using DiagnosticSource = Noesis.Scanner.Model.DiagnosticSource;
using DiagnosticSeverity = Noesis.Scanner.Model.DiagnosticSeverity;

namespace Noesis.Scanner.CSharp;

/// <summary>Scans one solution with Roslyn into the common code model: one manifest, one model file per project.</summary>
public static class CSharpScanner
{
    public static readonly Generator Generator = new("noesis-scan-csharp", InformationalVersion());

    public static async Task<ScanResult> ScanAsync(ScanRequest request, ScanLog log, CancellationToken cancellationToken = default)
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
                manifestDiagnostics.Add(ScannerError($"No C# project found under {string.Join(", ", request.Inputs)}."));
            var sourceAssemblies = solution.Projects.Select(project => project.AssemblyName).ToHashSet(StringComparer.Ordinal);
            var keys = new CacheKeys(request, sourceAssemblies, solution.ProblemsOf);
            var scanner = new ArtifactScanner(Generator, request.RepositoryRoot, sourceAssemblies, cache, keys, log);
            var stems = new FileStems();
            foreach (var project in solution.Projects)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var stem = stems.Next(project.AssemblyName);
                var scan = await scanner.ScanAsync(project, stem, solution.ProblemsOf(project), cancellationToken);
                artifacts.Add(new ManifestArtifact(scan.Model.Artifact.Id, CodeModelWriter.ArtifactFile(Language.CSharp, stem)));
                models.Add(scan.Model);
                if (scan.Loaded) loaded++;
                if (scan.Cached) cached.Add(scan.Model.Artifact.Id);
            }
            if (cache.Enabled && request.Projects.Count == 0 && request.ExcludeProjects.Count == 0) cache.Sweep(stems.Used);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            manifestDiagnostics.Add(ScannerError(exception.Message));
            log.Warn(exception.ToString());
        }

        var manifest = new ScanManifest(
            ScanManifest.CurrentSchemaVersion,
            Generator,
            Language.CSharp,
            new RepositoryInfo(request.RepositoryName, request.Revision),
            Root(request),
            artifacts,
            manifestDiagnostics);
        await CodeModelWriter.WriteAsync(request.OutputDirectory, manifest, models, cancellationToken);
        if (cache.Enabled) log.Info($"Cache: {cached.Count} of {models.Count} model(s) reused from {request.CacheDirectory}");
        var exitCode = loaded > 0 ? ScanExitCode.Success : ScanExitCode.NothingLoaded;
        return new ScanResult(manifest, models, request.OutputDirectory, exitCode, cached);
    }

    private static Diagnostic ScannerError(string message) =>
        new(DiagnosticSeverity.Error, "NS1001", message, null, DiagnosticSource.Scanner);

    /// <summary>The inputs relative to the repository root, `;`-joined when several were given.</summary>
    private static string Root(ScanRequest request)
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
        var version = typeof(CSharpScanner).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return version?.Split('+')[0] ?? "0.0.0";
    }
}
