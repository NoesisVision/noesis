namespace Noesis.Scanner.Model;

public sealed record MethodNode : DeclarationNode
{
    public required MethodKind MethodKind { get; init; }
    public required Visibility Visibility { get; init; }
    public required IReadOnlyList<Modifier> Modifiers { get; init; }
    public required IReadOnlyList<TypeParameter> TypeParameters { get; init; }
    public required Signature Signature { get; init; }
    public required TypeRef? ExtensionReceiver { get; init; }
    /// <summary>True when the body is absent by design: abstract, interface member, extern, partial without implementation.</summary>
    public required bool Bodiless { get; init; }
}