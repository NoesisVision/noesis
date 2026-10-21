package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = TypeParameterConstraint.TypeConstraint.class, name = "type"),
    @JsonSubTypes.Type(value = TypeParameterConstraint.ReferenceType.class, name = "referenceType"),
    @JsonSubTypes.Type(value = TypeParameterConstraint.ValueType.class, name = "valueType"),
    @JsonSubTypes.Type(value = TypeParameterConstraint.NotNull.class, name = "notNull"),
    @JsonSubTypes.Type(value = TypeParameterConstraint.ParameterlessConstructor.class, name = "parameterlessConstructor"),
    @JsonSubTypes.Type(value = TypeParameterConstraint.Other.class, name = "other"),
})
public sealed interface TypeParameterConstraint {

    record TypeConstraint(TypeRef type) implements TypeParameterConstraint {}

    record ReferenceType() implements TypeParameterConstraint {}

    record ValueType() implements TypeParameterConstraint {}

    record NotNull() implements TypeParameterConstraint {}

    record ParameterlessConstructor() implements TypeParameterConstraint {}

    record Other(String text) implements TypeParameterConstraint {}
}
