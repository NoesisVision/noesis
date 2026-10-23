package vision.noesis.scanner.core.bytecode;

import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaEnumConstant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.core.java.Literals;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.AnnotationArgument;
import vision.noesis.scanner.model.AnnotationValue;

/** Annotations as the class file stores them: explicit element values only; {@code value} alone counts as positional. */
final class BytecodeAnnotations {

    private final BytecodeContext context;

    BytecodeAnnotations(BytecodeContext context) {
        this.context = context;
    }

    /** ArchUnit hands annotations over as a set, so they are ordered by type here; the source engine keeps the written order. */
    List<Annotation> of(Collection<? extends JavaAnnotation<?>> annotations) {
        List<Annotation> result = new ArrayList<>();
        for (JavaAnnotation<?> annotation : annotations) result.add(of(annotation));
        result.sort(java.util.Comparator.comparing((Annotation annotation) -> annotation.type().canonical()).thenComparing(annotation -> annotation.arguments().toString()));
        return result;
    }

    Annotation of(JavaAnnotation<?> annotation) {
        List<AnnotationArgument> arguments = new ArrayList<>();
        for (Map.Entry<String, Object> property : annotation.getProperties().entrySet()) {
            if (!annotation.hasExplicitlyDeclaredProperty(property.getKey())) continue;
            arguments.add(new AnnotationArgument(property.getKey(), property.getKey().equals("value"), valueOf(property.getValue())));
        }
        return new Annotation(context.types.of(annotation.getRawType()), arguments);
    }

    AnnotationValue valueOf(Object value) {
        if (value instanceof JavaClass type) return new AnnotationValue.TypeValue(context.types.of(type));
        if (value instanceof JavaEnumConstant constant) return new AnnotationValue.EnumValue(context.types.of(constant.getDeclaringClass()), constant.name());
        if (value instanceof JavaAnnotation<?> nested) return new AnnotationValue.Nested(of(nested));
        if (value instanceof Object[] items) {
            List<AnnotationValue> values = new ArrayList<>(items.length);
            for (Object item : items) values.add(valueOf(item));
            return new AnnotationValue.Array(values);
        }
        if (value != null && value.getClass().isArray()) {
            List<AnnotationValue> values = new ArrayList<>();
            int length = java.lang.reflect.Array.getLength(value);
            for (int i = 0; i < length; i++) values.add(valueOf(java.lang.reflect.Array.get(value, i)));
            return new AnnotationValue.Array(values);
        }
        if (value instanceof String || value instanceof Boolean || value instanceof Character || value instanceof Number) {
            return new AnnotationValue.Literal(Literals.format(value));
        }
        return new AnnotationValue.Other(String.valueOf(value));
    }
}
