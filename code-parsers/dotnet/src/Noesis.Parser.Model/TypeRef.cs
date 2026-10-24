using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

/// <summary>A structural reference to a type; no language bag, so single-language refinements keep neutral defaults.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NamedTypeRef), "named")]
[JsonDerivedType(typeof(TypeParameterRef), "typeParameter")]
[JsonDerivedType(typeof(ArrayTypeRef), "array")]
[JsonDerivedType(typeof(TupleTypeRef), "tuple")]
[JsonDerivedType(typeof(FunctionTypeRef), "function")]
[JsonDerivedType(typeof(StructuralTypeRef), "structural")]
[JsonDerivedType(typeof(PointerTypeRef), "pointer")]
[JsonDerivedType(typeof(UnionTypeRef), "union")]
[JsonDerivedType(typeof(IntersectionTypeRef), "intersection")]
[JsonDerivedType(typeof(LiteralTypeRef), "literal")]
[JsonDerivedType(typeof(PrimitiveTypeRef), "primitive")]
[JsonDerivedType(typeof(DynamicTypeRef), "dynamic")]
[JsonDerivedType(typeof(VoidTypeRef), "void")]
[JsonDerivedType(typeof(UnresolvedTypeRef), "unresolved")]
[JsonDerivedType(typeof(OtherTypeRef), "other")]
public abstract record TypeRef
{
    /// <summary>The grammar shared with ids: ``List`1[int]``, ``List`1&lt;&gt;``, `int[,]`, `!0`, `!!1`, `(int,string)`.</summary>
    [JsonIgnore]
    public string Canonical => CanonicalString.Of(this);
}