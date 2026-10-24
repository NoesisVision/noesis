using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NamespaceNode), "namespace")]
[JsonDerivedType(typeof(TypeNode), "type")]
[JsonDerivedType(typeof(MethodNode), "method")]
[JsonDerivedType(typeof(PropertyNode), "property")]
[JsonDerivedType(typeof(FieldNode), "field")]
public abstract record DeclarationNode
{
    public required NodeId Id { get; init; }
    public required string Name { get; init; }
    public required Origin Origin { get; init; }
    public required IReadOnlyList<SourceSpan> Locations { get; init; }
    public required IReadOnlyList<Annotation> Annotations { get; init; }
    public required string? Documentation { get; init; }
    public required LanguageBag LanguageSpecific { get; init; }
}