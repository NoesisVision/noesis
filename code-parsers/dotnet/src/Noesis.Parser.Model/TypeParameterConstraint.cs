using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(TypeConstraint), "type")]
[JsonDerivedType(typeof(ReferenceTypeConstraint), "referenceType")]
[JsonDerivedType(typeof(ValueTypeConstraint), "valueType")]
[JsonDerivedType(typeof(NotNullConstraint), "notNull")]
[JsonDerivedType(typeof(ParameterlessConstructorConstraint), "parameterlessConstructor")]
[JsonDerivedType(typeof(OtherConstraint), "other")]
public abstract record TypeParameterConstraint;