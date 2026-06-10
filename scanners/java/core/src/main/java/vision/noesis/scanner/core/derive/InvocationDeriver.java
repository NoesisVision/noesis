package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;

/**
 * Derives INVOKES edges between behaviours from ArchUnit method calls.
 * TODO (design-doc §10): collapse calls routed through private helpers of the
 * same block onto the public behaviour, and handle ambiguous (0..n) targets.
 */
public final class InvocationDeriver {

    public void derive(Map<JavaMethod, Node> behaviours, Derived out) {
        Set<String> behaviourIds = behaviours.values().stream().map(Node::id).collect(Collectors.toSet());
        behaviours.forEach((method, behaviour) -> {
            for (JavaMethodCall call : method.getMethodCallsFromSelf()) {
                String targetId = call.getTarget().getFullName();
                if (behaviourIds.contains(targetId) && !targetId.equals(behaviour.id())) {
                    out.edges.add(new Edge(behaviour.id(), targetId, EdgeType.INVOKES,
                            List.of(call.getSourceCodeLocation().toString())));
                }
            }
        });
    }
}
