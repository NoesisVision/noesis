namespace Noesis.Scanner.Model;

/// <summary>What the server opens first: every file the scan produced, in dependency order.</summary>
public sealed record ScanManifest(
    int SchemaVersion,
    Generator Generator,
    Language Language,
    RepositoryInfo Repository,
    string Root,
    IReadOnlyList<ManifestArtifact> Artifacts,
    IReadOnlyList<Diagnostic> Diagnostics)
{
    public const int CurrentSchemaVersion = 1;
}