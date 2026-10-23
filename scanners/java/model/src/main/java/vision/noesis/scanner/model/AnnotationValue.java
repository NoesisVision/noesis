package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = AnnotationValue.Literal.class, name = "literal"),
    @JsonSubTypes.Type(value = AnnotationValue.TypeValue.class, name = "type"),
    @JsonSubTypes.Type(value = AnnotationValue.EnumValue.class, name = "enum"),
    @JsonSubTypes.Type(value = AnnotationValue.Array.class, name = "array"),
    @JsonSubTypes.Type(value = AnnotationValue.Nested.class, name = "annotation"),
    @JsonSubTypes.Type(value = AnnotationValue.Other.class, name = "other"),
})
public sealed interface AnnotationValue {

    record Literal(String text) implements AnnotationValue {}

    record TypeValue(TypeRef type) implements AnnotationValue {}

    record EnumValue(TypeRef type, String member) implements AnnotationValue {}

    record Array(List<AnnotationValue> items) implements AnnotationValue {}

    record Nested(Annotation annotation) implements AnnotationValue {}

    record Other(String text) implements AnnotationValue {}
}
