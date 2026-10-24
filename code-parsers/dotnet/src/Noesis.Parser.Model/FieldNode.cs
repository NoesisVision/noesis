namespace Noesis.Parser.Model;

public sealed record FieldNode : DeclarationNode
{
    public required FieldKind FieldKind { get; init; }
    public required Visibility Visibility { get; init; }
    public required IReadOnlyList<Modifier> Modifiers { get; init; }
    public required TypeRef Type { get; init; }
    public required Passing Passing { get; init; }
    public required string? ConstantValue { get; init; }
}