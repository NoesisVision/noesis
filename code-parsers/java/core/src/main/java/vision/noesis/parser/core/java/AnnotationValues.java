package vision.noesis.parser.core.java;

import java.util.stream.Collectors;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationValue;

/** An annotation value as the text a bag holds: the literal, the type's canonical string, {@code Type.MEMBER}, {@code [a, b]}, {@code @Type(name=value)}. */
public final class AnnotationValues {

    private AnnotationValues() {}

    public static String text(AnnotationValue value) {
        if (value instanceof AnnotationValue.Literal literal) return literal.text();
        if (value instanceof AnnotationValue.TypeValue type) return type.type().canonical();
        if (value instanceof AnnotationValue.EnumValue constant) return constant.type().canonical() + "." + constant.member();
        if (value instanceof AnnotationValue.Array array) return array.items().stream().map(AnnotationValues::text).collect(Collectors.joining(", ", "[", "]"));
        if (value instanceof AnnotationValue.Nested nested) return text(nested.annotation());
        return ((AnnotationValue.Other) value).text();
    }

    private static String text(Annotation annotation) {
        return "@" + annotation.type().canonical() + annotation.arguments().stream()
                .map(argument -> argument.name() + "=" + text(argument.value())).collect(Collectors.joining(", ", "(", ")"));
    }
}
