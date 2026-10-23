using System.Security.Cryptography;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Noesis.Scanner.CSharp.Loading;
using Noesis.Scanner.CSharp.Mapping;
using Noesis.Scanner.Model;
using Diagnostic = Noesis.Scanner.Model.Diagnostic;

namespace Noesis.Scanner.CSharp.Caching;

/// <summary>
/// The key of a project's model: one SHA-256 over every input the model is a function of, one line per input,
/// computed before the compilation exists. A referenced project's key is an input to its dependents' key, so the
/// keys of every project a scanned project references are computed too, scanned or not. Memoised per project.
/// Rules in docs/plans/code-model-cache.md, section 3.2.
/// </summary>
internal sealed class CacheKeys(ScanRequest request, IReadOnlySet<string> sourceAssemblyNames, Func<Project, IReadOnlyList<Diagnostic>> problemsOf)
{
    private static readonly string ScannerIdentity = string.Join(' ',
        ScanManifest.CurrentSchemaVersion,
        CSharpScanner.Generator.Name,
        CSharpScanner.Generator.Version,
        typeof(CSharpScanner).Assembly.ManifestModule.ModuleVersionId,
        typeof(CodeModelFile).Assembly.ManifestModule.ModuleVersionId);

    private readonly Dictionary<ProjectId, string> _keys = [];
    private readonly Locations _locations = new(request.RepositoryRoot);

    public async Task<string> KeyOf(Project project, CancellationToken cancellationToken)
    {
        if (_keys.TryGetValue(project.Id, out var known)) return known;
        var text = await CanonicalTextOf(project, cancellationToken);
        var key = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
        _keys[project.Id] = key;
        return key;
    }

    /// <summary>The text the key hashes; exposed for the tests, which assert what changes it.</summary>
    internal async Task<string> CanonicalTextOf(Project project, CancellationToken cancellationToken)
    {
        var lines = new List<string>
        {
            $"scanner {ScannerIdentity}",
            $"configuration {request.Configuration}",
            $"tfm {request.TargetFramework ?? "-"}",
            $"source-assemblies {string.Join(';', sourceAssemblyNames.Order(StringComparer.Ordinal))}",
            $"assembly {project.AssemblyName}",
            $"project {(project.FilePath is null ? "-" : _locations.RelativePath(project.FilePath))}",
            $"target {TargetFrameworks.Of(project)}",
            $"root-namespace {project.DefaultNamespace ?? "-"}",
        };
        lines.AddRange(OptionLines(project));
        lines.AddRange(await DocumentLines("document", project.Documents, cancellationToken));
        lines.AddRange(await DocumentLines("additional", project.AdditionalDocuments, cancellationToken));
        lines.AddRange(await DocumentLines("analyzer-config", project.AnalyzerConfigDocuments, cancellationToken));
        lines.AddRange(project.AnalyzerReferences.Select(reference => FileLine("analyzer", reference.FullPath)).Order(StringComparer.Ordinal));
        lines.AddRange(project.MetadataReferences.Select(reference => FileLine("metadata", (reference as PortableExecutableReference)?.FilePath)).Order(StringComparer.Ordinal));
        lines.AddRange(await ProjectReferenceLines(project, cancellationToken));
        lines.AddRange(problemsOf(project).Select(problem => $"problem {problem.Severity} {problem.Code} {problem.Message}").Order(StringComparer.Ordinal));
        return string.Join('\n', lines);
    }

    private static IEnumerable<string> OptionLines(Project project)
    {
        if (project.ParseOptions is CSharpParseOptions parse)
        {
            yield return $"language-version {parse.LanguageVersion}";
            yield return $"preprocessor {string.Join(';', parse.PreprocessorSymbolNames.Order(StringComparer.Ordinal))}";
            yield return $"documentation-mode {parse.DocumentationMode}";
            yield return $"features {string.Join(';', parse.Features.Select(feature => $"{feature.Key}={feature.Value}").Order(StringComparer.Ordinal))}";
        }
        if (project.CompilationOptions is CSharpCompilationOptions compilation)
        {
            yield return $"output-kind {compilation.OutputKind}";
            yield return $"nullable {compilation.NullableContextOptions}";
            yield return $"unsafe {compilation.AllowUnsafe}";
            yield return $"checked {compilation.CheckOverflow}";
            yield return $"warning-level {compilation.WarningLevel}";
            yield return $"general-diagnostic {compilation.GeneralDiagnosticOption}";
            yield return $"platform {compilation.Platform}";
            yield return $"optimization {compilation.OptimizationLevel}";
            yield return $"main-type {compilation.MainTypeName ?? "-"}";
            foreach (var (id, report) in compilation.SpecificDiagnosticOptions.OrderBy(option => option.Key, StringComparer.Ordinal))
                yield return $"diagnostic-option {id}={report}";
        }
    }

    private async Task<IEnumerable<string>> DocumentLines(string kind, IEnumerable<TextDocument> documents, CancellationToken cancellationToken)
    {
        var lines = new List<string>();
        foreach (var document in documents)
        {
            var text = await document.GetTextAsync(cancellationToken);
            var checksum = text.GetChecksum();
            var hash = checksum.IsDefaultOrEmpty
                ? Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())))
                : Convert.ToHexStringLower(checksum.AsSpan());
            var path = document.FilePath is null ? document.Name : _locations.RelativePath(document.FilePath);
            lines.Add($"{kind} {path} {hash}");
        }
        lines.Sort(StringComparer.Ordinal);
        return lines;
    }

    private async Task<IEnumerable<string>> ProjectReferenceLines(Project project, CancellationToken cancellationToken)
    {
        var lines = new List<string>();
        foreach (var reference in project.ProjectReferences)
        {
            var referenced = project.Solution.GetProject(reference.ProjectId);
            lines.Add(referenced is null ? $"project-ref missing {reference.ProjectId}" : $"project-ref {referenced.AssemblyName} {await KeyOf(referenced, cancellationToken)}");
        }
        lines.Sort(StringComparer.Ordinal);
        return lines;
    }

    /// <summary>Path, length and last write: enough for package and reference-pack files, which never change in place.</summary>
    private static string FileLine(string kind, string? path)
    {
        if (path is null) return $"{kind} -";
        var file = new FileInfo(path);
        return file.Exists ? $"{kind} {path} {file.Length} {file.LastWriteTimeUtc.Ticks}" : $"{kind} {path} missing";
    }
}
