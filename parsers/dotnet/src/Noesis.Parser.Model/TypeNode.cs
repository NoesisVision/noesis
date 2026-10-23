namespace Noesis.Parser.Model;

public sealed record TypeNode : DeclarationNode
{
    public required TypeKind TypeKind { get; init; }
    public required Visibility Visibility { get; init; }
    public required IReadOnlyList<Modifier> Modifiers { get; init; }
    public required IReadOnlyList<TypeParameter> TypeParameters { get; init; }
    public required TypeRef? UnderlyingType { get; init; }
    public required Signature? DelegateSignature { get; init; }
    public required TypeRef? AliasOf { get; init; }
}