using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(ContainsEdge), "CONTAINS")]
[JsonDerivedType(typeof(ExtendsEdge), "EXTENDS")]
[JsonDerivedType(typeof(ImplementsEdge), "IMPLEMENTS")]
[JsonDerivedType(typeof(OverridesEdge), "OVERRIDES")]
[JsonDerivedType(typeof(ImplementsMemberEdge), "IMPLEMENTS_MEMBER")]
[JsonDerivedType(typeof(InvokesEdge), "INVOKES")]
[JsonDerivedType(typeof(AccessesEdge), "ACCESSES")]
[JsonDerivedType(typeof(UsesTypeEdge), "USES_TYPE")]
public abstract record Edge
{
    public required NodeId From { get; init; }
}