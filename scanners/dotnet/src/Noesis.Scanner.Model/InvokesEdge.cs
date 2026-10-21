namespace Noesis.Scanner.Model;

public sealed record InvokesEdge : Edge
{
    /// <summary>The method definition; a constructor for `new T()`.</summary>
    public required NodeId To { get; init; }
    public required IReadOnlyList<TypeRef> TypeArguments { get; init; }
    public required UsageSite Site { get; init; }
    public required InvocationKind InvocationKind { get; init; }
    public required ExpressionKind? Receiver { get; init; }
}