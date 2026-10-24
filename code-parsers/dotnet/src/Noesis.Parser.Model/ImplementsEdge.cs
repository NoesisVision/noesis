namespace Noesis.Parser.Model;

public sealed record ImplementsEdge : Edge
{
    public required TypeRef To { get; init; }
}