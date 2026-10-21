namespace Noesis.Scanner.Model;

public sealed record ContainsEdge : Edge
{
    public required NodeId To { get; init; }
}