namespace Noesis.Parser.Model;

public sealed record ContainsEdge : Edge
{
    public required NodeId To { get; init; }
}