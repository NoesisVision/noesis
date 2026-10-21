namespace Noesis.Scanner.Model;

public sealed record AccessesEdge : Edge
{
    public required NodeId To { get; init; }
    public required AccessKind Access { get; init; }
    public required UsageSite Site { get; init; }
    public required ExpressionKind? Receiver { get; init; }
}