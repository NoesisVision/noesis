namespace Noesis.Scanner.Model;

public sealed record ExtendsEdge : Edge
{
    public required TypeRef To { get; init; }
}