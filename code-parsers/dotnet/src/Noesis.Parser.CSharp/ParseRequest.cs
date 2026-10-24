namespace Noesis.Parser.CSharp;

/// <summary>What one parse covers and where it writes; every value the command line accepts, in one place.</summary>
public sealed record ParseRequest
{
    /// <summary>A directory, a `.sln`/`.slnx` file, or one or more `.csproj` files.</summary>
    public required IReadOnlyList<string> Inputs { get; init; }

    /// <summary>The directory file paths are written relative to; the parser does not read git.</summary>
    public required string RepositoryRoot { get; init; }

    /// <summary>The output root; the manifest and model files land under `code-model/csharp/` inside it.</summary>
    public required string OutputDirectory { get; init; }

    public string RepositoryName { get; init; } = "";

    public string Revision { get; init; } = "";

    public string Configuration { get; init; } = "Debug";

    /// <summary>Project-name globs; empty means every project.</summary>
    public IReadOnlyList<string> Projects { get; init; } = [];

    public IReadOnlyList<string> ExcludeProjects { get; init; } = [];

    /// <summary>The target framework of a multi-targeted project; null picks the highest.</summary>
    public string? TargetFramework { get; init; }

    public bool NoRestore { get; init; }

    /// <summary>Where cached model files live, `--cache`; null keeps no cache. Layout in docs/plans/code-model-cache.md.</summary>
    public string? CacheDirectory { get; init; }
}
