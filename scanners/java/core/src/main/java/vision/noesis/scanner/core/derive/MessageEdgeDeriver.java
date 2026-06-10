package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaConstructorCall;
import com.tngtech.archunit.core.domain.JavaMethod;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/**
 * Derives message communication edges:
 * SENDS — a behaviour instantiates a message type (constructor call);
 * HANDLES — an application-service behaviour takes a message as a parameter.
 * TODO (design-doc §10): dispatcher/bus invocation patterns for SENDS;
 * explicit handler annotations (e.g. jMolecules @DomainEventHandler) for HANDLES.
 */
public final class MessageEdgeDeriver {

    public void derive(Map<JavaMethod, Node> behaviours, Map<JavaClass, Node> classNodes, Derived out) {
        behaviours.forEach((method, behaviour) -> {
            for (JavaConstructorCall call : method.getConstructorCallsFromSelf()) {
                Node target = classNodes.get(call.getTargetOwner());
                if (target != null && target.type().isMessage()) {
                    out.edges.add(new Edge(behaviour.id(), target.id(), EdgeType.SENDS,
                            List.of(call.getSourceCodeLocation().toString())));
                }
            }
            if (isApplicationServiceBehaviour(method, classNodes)) {
                for (JavaClass parameterType : method.getRawParameterTypes()) {
                    Node parameterNode = classNodes.get(parameterType);
                    if (parameterNode != null && parameterNode.type().isMessage()) {
                        out.edges.add(new Edge(behaviour.id(), parameterNode.id(), EdgeType.HANDLES,
                                List.of(method.getSourceCodeLocation().toString())));
                    }
                }
            }
        });
    }

    private static boolean isApplicationServiceBehaviour(JavaMethod method, Map<JavaClass, Node> classNodes) {
        Node owner = classNodes.get(method.getOwner());
        return owner != null && owner.type() == NodeType.APPLICATION_SERVICE;
    }
}
