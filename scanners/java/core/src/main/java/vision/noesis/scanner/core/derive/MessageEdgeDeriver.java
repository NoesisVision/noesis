package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaConstructorCall;
import com.tngtech.archunit.core.domain.JavaMethod;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.core.model.BehaviourType;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/**
 * Derives message communication edges:
 * SENDS — a behaviour instantiates a message type (constructor call);
 * HANDLES — a behaviour takes a message as a parameter, and either its handler
 * annotation names that kind of message ({@code @EventHandler} for an event) or it
 * is an application-service behaviour without one.
 * TODO (design-doc §10): dispatcher/bus invocation patterns for SENDS.
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
            for (JavaClass parameterType : method.getRawParameterTypes()) {
                Node parameterNode = classNodes.get(parameterType);
                if (parameterNode != null && handles(method, behaviour, parameterNode, classNodes)) {
                    out.edges.add(new Edge(behaviour.id(), parameterNode.id(), EdgeType.HANDLES,
                            List.of(method.getSourceCodeLocation().toString())));
                }
            }
        });
    }

    private static boolean handles(JavaMethod method, Node behaviour, Node parameter, Map<JavaClass, Node> classNodes) {
        if (!parameter.type().isMessage()) {
            return false;
        }
        if (behaviour.behaviourType() != null) {
            return messageTypeOf(behaviour.behaviourType()) == parameter.type();
        }
        Node owner = classNodes.get(method.getOwner());
        return owner != null && owner.type() == NodeType.APPLICATION_SERVICE;
    }

    private static NodeType messageTypeOf(BehaviourType behaviourType) {
        return switch (behaviourType) {
            case COMMAND -> NodeType.COMMAND;
            case QUERY -> NodeType.QUERY;
            case EVENT -> NodeType.EVENT;
        };
    }
}
