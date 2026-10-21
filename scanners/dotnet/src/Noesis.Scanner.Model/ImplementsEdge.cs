namespace Noesis.Scanner.Model;

public sealed record ImplementsEdge : Edge
{
    public required TypeRef To { get; init; }
}