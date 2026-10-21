using System.Reflection;
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
        var models = new List<CodeModelFile>();
        var loaded = 0;
        try
        {
            using var solution = await new SolutionLoader(request, log).LoadAsync(cancellationToken);
            manifestDiagnostics.AddRange(solution.SolutionProblems);
            if (solution.Projects.Count == 0)
                manifestDiagnostics.Add(ScannerError($"No C# project found under {string.Join(", ", request.Inputs)}."));
            var sourceAssemblies = solution.Projects.Select(project => project.AssemblyName).ToHashSet(StringComparer.Ordinal);
            var scanner = new ArtifactScanner(Generator, request.RepositoryRoot, sourceAssemblies, log);
            foreach (var project in solution.Projects)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var (model, wasLoaded) = await scanner.ScanAsync(project, solution.ProblemsOf(project), cancellationToken);
                models.Add(model);
                if (wasLoaded) loaded++;
            }
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
            ArtifactFiles(models),
            manifestDiagnostics);
        await CodeModelWriter.WriteAsync(request.OutputDirectory, manifest, models, cancellationToken);
        var exitCode = loaded > 0 ? ScanExitCode.Success : ScanExitCode.NothingLoaded;
        return new ScanResult(manifest, models, request.OutputDirectory, exitCode);
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

    /// <summary>One file per model, named after the assembly; a second assembly of the same name gets `~2`.</summary>
    private static IReadOnlyList<ManifestArtifact> ArtifactFiles(IReadOnlyList<CodeModelFile> models)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var files = new List<ManifestArtifact>();
        foreach (var model in models)
        {
            var name = model.Artifact.Name;
            var candidate = name;
            for (var i = 2; !used.Add(candidate); i++) candidate = $"{name}~{i}";
            files.Add(new ManifestArtifact(model.Artifact.Id, CodeModelWriter.ArtifactFile(Language.CSharp, candidate)));
        }
        return files;
    }

    private static string InformationalVersion()
    {
        var version = typeof(CSharpScanner).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        return version?.Split('+')[0] ?? "0.0.0";
    }
}
