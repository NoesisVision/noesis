using System.Text.Json;
using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Loading;

/// <summary>
/// The restore output of a project (`obj/project.assets.json`): which NuGet package ships which referenced assembly,
/// and which shared frameworks the project targets, so their reference assemblies count as platform wherever they sit.
/// </summary>
internal sealed class ProjectAssets
{
    private readonly List<(PackageReference Package, string PathSegment)> _libraries;
    private readonly List<string> _frameworkPackSegments;

    private ProjectAssets(List<(PackageReference, string)> libraries, List<string> frameworkPackSegments)
    {
        _libraries = libraries;
        _frameworkPackSegments = frameworkPackSegments;
    }

    /// <summary>No restore output: nothing maps to a package and nothing is platform.</summary>
    public static readonly ProjectAssets Empty = new([], []);

    public static string PathFor(string projectFile) => Path.Combine(Path.GetDirectoryName(projectFile)!, "obj", "project.assets.json");

    public static bool Exists(string projectFile) => File.Exists(PathFor(projectFile));

    public static ProjectAssets Load(string projectFile)
    {
        var path = PathFor(projectFile);
        if (!File.Exists(path)) return Empty;
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            return new ProjectAssets(Libraries(document.RootElement), FrameworkPackSegments(document.RootElement));
        }
        catch (JsonException)
        {
            return Empty;
        }
    }

    /// <summary>The package whose extracted directory holds the assembly; null for anything outside a package.</summary>
    public PackageReference? PackageOf(string? assemblyPath)
    {
        if (assemblyPath is null) return null;
        var normalised = assemblyPath.Replace('\\', '/').ToLowerInvariant();
        foreach (var (package, segment) in _libraries)
            if (normalised.Contains(segment, StringComparison.Ordinal)) return package;
        return null;
    }

    /// <summary>
    /// True for a reference assembly of a framework the project references: the targeting pack `&lt;framework&gt;.Ref`
    /// is a directory on the path whether the SDK ships it (`packs/Microsoft.NETCore.App.Ref/`) or restore downloaded
    /// it (`.nuget/packages/microsoft.netcore.app.ref/`).
    /// </summary>
    public bool IsFrameworkAssembly(string? assemblyPath)
    {
        if (assemblyPath is null) return false;
        var normalised = assemblyPath.Replace('\\', '/').ToLowerInvariant();
        return _frameworkPackSegments.Any(segment => normalised.Contains(segment, StringComparison.Ordinal));
    }

    /// <summary>`libraries` entries of type `package`, keyed by their `path` so an assembly under the extracted package maps back.</summary>
    private static List<(PackageReference, string)> Libraries(JsonElement root)
    {
        var libraries = new List<(PackageReference, string)>();
        if (!root.TryGetProperty("libraries", out var element)) return libraries;
        foreach (var library in element.EnumerateObject())
        {
            if (library.Value.TryGetProperty("type", out var type) && type.GetString() != "package") continue;
            var parts = library.Name.Split('/');
            if (parts.Length != 2) continue;
            var segment = library.Value.TryGetProperty("path", out var pathProperty) ? pathProperty.GetString() ?? library.Name : library.Name;
            libraries.Add((new PackageReference(parts[0], parts[1]), DirectorySegment(segment)));
        }
        return libraries;
    }

    /// <summary>`project.frameworks.*.frameworkReferences` names (`Microsoft.NETCore.App`, `Microsoft.AspNetCore.App`), as targeting pack directory segments.</summary>
    private static List<string> FrameworkPackSegments(JsonElement root)
    {
        var segments = new List<string>();
        if (!root.TryGetProperty("project", out var project) || !project.TryGetProperty("frameworks", out var frameworks)) return segments;
        foreach (var framework in frameworks.EnumerateObject())
        {
            if (!framework.Value.TryGetProperty("frameworkReferences", out var references)) continue;
            foreach (var reference in references.EnumerateObject())
                segments.Add(DirectorySegment(reference.Name + ".Ref"));
        }
        return segments;
    }

    private static string DirectorySegment(string name) => "/" + name.ToLowerInvariant().Trim('/') + "/";
}
