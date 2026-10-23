namespace Noesis.Parser.Model;

public sealed record ExtendsEdge : Edge
{
    public required TypeRef To { get; init; }
}