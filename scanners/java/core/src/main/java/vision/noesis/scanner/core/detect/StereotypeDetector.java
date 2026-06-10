package vision.noesis.scanner.core.detect;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaEnumConstant;
import java.util.LinkedHashMap;
import java.util.Map;
import vision.noesis.scanner.core.config.StereotypeMapping;
import vision.noesis.scanner.core.config.StereotypeMapping.MappedStereotype;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;
import vision.noesis.scanner.core.model.PortDirection;

/** Finds annotated building blocks and messages in ArchUnit's class graph. */
public final class StereotypeDetector {

    private final StereotypeMapping mapping;

    public StereotypeDetector(StereotypeMapping mapping) {
        this.mapping = mapping;
    }

    /** Returns class-backed nodes (blocks and messages) keyed by their JavaClass. */
    public Map<JavaClass, Node> detect(JavaClasses classes) {
        Map<JavaClass, Node> result = new LinkedHashMap<>();
        for (JavaClass clazz : classes) {
            mapping.asMap().forEach((annotationFqn, stereotype) -> {
                if (!result.containsKey(clazz)
                        && (clazz.isAnnotatedWith(annotationFqn) || clazz.isMetaAnnotatedWith(annotationFqn))) {
                    result.put(clazz, toNode(clazz, annotationFqn, stereotype));
                }
            });
        }
        return result;
    }

    private Node toNode(JavaClass clazz, String annotationFqn, MappedStereotype stereotype) {
        PortDirection direction = stereotype.direction();
        if (direction == null && needsDirection(stereotype.type())) {
            direction = directionFromAttribute(clazz, annotationFqn);
        }
        return new Node(
                clazz.getName(),
                stereotype.type(),
                clazz.getSimpleName(),
                clazz.getPackageName(),
                direction,
                null,
                clazz.getSourceCodeLocation().toString());
    }

    private static boolean needsDirection(NodeType type) {
        return type == NodeType.PORT || type == NodeType.ADAPTER;
    }

    /** Reads the `value` attribute of the noesis @Port/@Adapter annotations. */
    private static PortDirection directionFromAttribute(JavaClass clazz, String annotationFqn) {
        return clazz.tryGetAnnotationOfType(annotationFqn)
                .flatMap(annotation -> annotation.get("value"))
                .filter(JavaEnumConstant.class::isInstance)
                .map(value -> PortDirection.valueOf(((JavaEnumConstant) value).name()))
                .orElse(null);
    }
}
