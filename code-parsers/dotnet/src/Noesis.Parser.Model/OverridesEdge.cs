namespace Noesis.Parser.Model;

public sealed record OverridesEdge : Edge
{
    public required NodeId To { get; init; }
}