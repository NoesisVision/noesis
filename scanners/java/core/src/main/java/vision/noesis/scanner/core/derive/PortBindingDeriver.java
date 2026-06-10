package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import java.util.Map;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/** Derives IMPLEMENTS edges: an adapter class implementing a port interface. */
public final class PortBindingDeriver {

    public void derive(Map<JavaClass, Node> classNodes, Derived out) {
        classNodes.forEach((clazz, node) -> {
            if (node.type() != NodeType.ADAPTER) {
                return;
            }
            for (JavaClass iface : clazz.getRawInterfaces()) {
                Node ifaceNode = classNodes.get(iface);
                if (ifaceNode != null && ifaceNode.type() == NodeType.PORT) {
                    out.edges.add(Edge.of(node.id(), ifaceNode.id(), EdgeType.IMPLEMENTS));
                }
            }
        });
    }
}
