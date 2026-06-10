package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import java.util.LinkedHashMap;
import java.util.Map;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/**
 * Derives BEHAVIOUR nodes (public, non-synthetic methods of building blocks)
 * and the owning CONTAINS edges. Messages and groupings have no behaviours.
 */
public final class BehaviourDeriver {

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

    private static boolean isBehaviour(JavaMethod method) {
        return method.getModifiers().contains(JavaModifier.PUBLIC)
                && !method.getModifiers().contains(JavaModifier.SYNTHETIC)
                && !method.getModifiers().contains(JavaModifier.BRIDGE);
    }

    private static Node toNode(JavaMethod method, JavaClass owner) {
        return new Node(
                method.getFullName(),
                NodeType.BEHAVIOUR,
                method.getName(),
                owner.getPackageName(),
                null,
                method.getDescriptor(),
                method.getSourceCodeLocation().toString());
    }
}
