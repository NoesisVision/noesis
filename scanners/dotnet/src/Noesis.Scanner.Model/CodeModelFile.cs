namespace Noesis.Scanner.Model;

/// <summary>One artifact: its declarations (sorted by id), edges (sorted by kind, from, target, location) and stubs.</summary>
public sealed record CodeModelFile(
    int SchemaVersion,
    Generator Generator,
    ArtifactNode Artifact,
    IReadOnlyList<DeclarationNode> Nodes,
    IReadOnlyList<Edge> Edges,
    IReadOnlyList<StubNode> Stubs,
    IReadOnlyList<Diagnostic> Diagnostics)
{
    public static CodeModelFile Sorted(Generator generator, ArtifactNode artifact, IEnumerable<DeclarationNode> nodes, IEnumerable<Edge> edges, IEnumerable<StubNode> stubs, IEnumerable<Diagnostic> diagnostics) =>
        new(
            ScanManifest.CurrentSchemaVersion,
            generator,
            artifact,
            nodes.OrderBy(node => node.Id).ToArray(),
            edges.Order(Comparer<Edge>.Create(EdgeOrdering.Compare)).ToArray(),
            stubs.OrderBy(stub => stub.Id).ToArray(),
            diagnostics.OrderBy(diagnostic => diagnostic.Location, Comparer<SourceSpan?>.Create(CompareLocations)).ThenBy(diagnostic => diagnostic.Code, StringComparer.Ordinal).ThenBy(diagnostic => diagnostic.Message, StringComparer.Ordinal).ToArray());

    private static int CompareLocations(SourceSpan? left, SourceSpan? right) =>
        left is null ? (right is null ? 0 : -1) : right is null ? 1 : left.CompareTo(right);
}