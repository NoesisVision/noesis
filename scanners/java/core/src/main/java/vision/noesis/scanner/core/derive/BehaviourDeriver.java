package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import vision.noesis.scanner.core.config.StereotypeMapping;
import vision.noesis.scanner.core.model.BehaviourType;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/**
 * Derives BEHAVIOUR nodes (public, non-synthetic methods of building blocks,
 * except the ones Java writes for every class, record or enum)
 * and the owning CONTAINS edges. A behaviour's type comes from its handler
 * annotation; one without has none. Messages and groupings have no behaviours.
 */
public final class BehaviourDeriver {

    private final StereotypeMapping mapping;

    public BehaviourDeriver(StereotypeMapping mapping) {
        this.mapping = mapping;
    }

    /** Returns behaviour nodes keyed by their JavaMethod; CONTAINS edges go to {@code out}. */
    public Map<JavaMethod, Node> derive(Map<JavaClass, Node> classNodes, Derived out) {
        Map<JavaMethod, Node> behaviours = new LinkedHashMap<>();
        classNodes.forEach((clazz, node) -> {
            if (!node.type().isBlock()) {
                return;
            }
            for (JavaMethod method : clazz.getMethods()) {
                if (isBehaviour(method)) {
                    Node behaviour = toNode(method, clazz);
                    behaviours.put(method, behaviour);
                    out.nodes.add(behaviour);
                    out.edges.add(Edge.of(node.id(), behaviour.id(), EdgeType.CONTAINS));
                }
            }
        });
        return behaviours;
    }

    private Node toNode(JavaMethod method, JavaClass owner) {
        return new Node(
                method.getFullName(),
                NodeType.BEHAVIOUR,
                method.getName(),
                owner.getPackageName(),
                null,
                behaviourTypeOf(method),
                method.getDescriptor(),
                method.getSourceCodeLocation().toString());
    }

    /** The type of a mapped annotation the method carries, or null when it carries none. */
    private BehaviourType behaviourTypeOf(JavaMethod method) {
        return mapping.behaviourTypes().entrySet().stream()
                .filter(entry -> method.isAnnotatedWith(entry.getKey()) || method.isMetaAnnotatedWith(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private static boolean isBehaviour(JavaMethod method) {
        return method.getModifiers().contains(JavaModifier.PUBLIC)
                && !method.getModifiers().contains(JavaModifier.SYNTHETIC)
                && !method.getModifiers().contains(JavaModifier.BRIDGE)
                && !isWrittenByJava(method);
    }

    /** Methods every class, record or enum has, which say nothing about the domain. */
    private static boolean isWrittenByJava(JavaMethod method) {
        return isObjectMethod(method) || isRecordAccessor(method) || isEnumMethod(method);
    }

    private static boolean isObjectMethod(JavaMethod method) {
        if (method.getModifiers().contains(JavaModifier.STATIC)) {
            return false;
        }
        return switch (method.getName()) {
            case "equals" -> hasParameters(method, Object.class);
            case "hashCode", "toString" -> hasParameters(method);
            default -> false;
        };
    }

    private static boolean isRecordAccessor(JavaMethod method) {
        JavaClass owner = method.getOwner();
        return owner.isRecord()
                && !method.getModifiers().contains(JavaModifier.STATIC)
                && hasParameters(method)
                && owner.tryGetField(method.getName())
                        .filter(field -> field.getRawType().equals(method.getRawReturnType()))
                        .isPresent();
    }

    private static boolean isEnumMethod(JavaMethod method) {
        if (!method.getOwner().isEnum() || !method.getModifiers().contains(JavaModifier.STATIC)) {
            return false;
        }
        return switch (method.getName()) {
            case "values" -> hasParameters(method);
            case "valueOf" -> hasParameters(method, String.class);
            default -> false;
        };
    }

    private static boolean hasParameters(JavaMethod method, Class<?>... types) {
        return method.getRawParameterTypes().stream().map(JavaClass::getName).toList()
                .equals(Arrays.stream(types).map(Class::getName).toList());
    }
}
