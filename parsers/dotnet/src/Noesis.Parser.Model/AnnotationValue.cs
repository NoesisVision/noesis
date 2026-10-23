using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(LiteralAnnotationValue), "literal")]
[JsonDerivedType(typeof(TypeAnnotationValue), "type")]
[JsonDerivedType(typeof(EnumAnnotationValue), "enum")]
[JsonDerivedType(typeof(ArrayAnnotationValue), "array")]
[JsonDerivedType(typeof(NestedAnnotationValue), "annotation")]
[JsonDerivedType(typeof(OtherAnnotationValue), "other")]
public abstract record AnnotationValue;