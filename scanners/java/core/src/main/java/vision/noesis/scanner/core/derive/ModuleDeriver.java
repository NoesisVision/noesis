package vision.noesis.scanner.core.derive;

import com.tngtech.archunit.core.domain.JavaClass;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import vision.noesis.scanner.core.model.Edge;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;

/**
 * Derives MODULE grouping nodes from the packages of detected blocks/messages,
 * plus CONTAINS (module → block | message) and EXPOSES (module → port) edges.
 * TODO: honour @Module on package-info and support nested module hierarchies.
 */
public final class ModuleDeriver {

    public Derived derive(Map<JavaClass, Node> classNodes) {
        Derived out = new Derived();
        Set<String> packages = new LinkedHashSet<>();
        for (Node node : classNodes.values()) {
            String pkg = node.group();
            if (packages.add(pkg)) {
                out.nodes.add(Node.grouping(pkg, NodeType.MODULE, localName(pkg)));
            }
            out.edges.add(Edge.of(pkg, node.id(), EdgeType.CONTAINS));
            if (node.type() == NodeType.PORT) {
                out.edges.add(Edge.of(pkg, node.id(), EdgeType.EXPOSES));
            }
        }
        return out;
    }

    private static String localName(String packageName) {
        int lastDot = packageName.lastIndexOf('.');
        return lastDot < 0 ? packageName : packageName.substring(lastDot + 1);
    }
}
