namespace Noesis.Parser.Model;

public sealed record UsesTypeEdge : Edge
{
    public required TypeRef To { get; init; }
    public required TypeUseRole Role { get; init; }
    public required UsageSite Site { get; init; }
}