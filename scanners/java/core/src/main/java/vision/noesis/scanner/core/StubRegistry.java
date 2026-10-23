package vision.noesis.scanner.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.StubKind;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeKind;

/**
 * The external closure of one artifact: every symbol outside the scanned modules that an id was built for, its
 * containing types and namespaces, and for a type its base chain. Idempotent: a symbol is stubbed once.
 */
public final class StubRegistry {

    private final Map<NodeId, StubNode> stubs = new LinkedHashMap<>();
    private final Map<NodeId, NamespaceStub> namespaces = new LinkedHashMap<>();
    private final List<Edge> edges = new ArrayList<>();

    /** A namespace may be declared by several artifacts; the stub names the first by id. */
    private record NamespaceStub(String name, TreeSet<NodeId> artifacts) {}

    /** @return true when the type was not stubbed before, so the caller adds its base chain. */
    public boolean type(NodeId id, String name, TypeKind kind, NodeId artifact) {
        if (stubs.containsKey(id)) return false;
        stubs.put(id, new StubNode(id, StubKind.TYPE, name, kind, artifact));
        return true;
    }

    public void member(NodeId id, StubKind kind, String name, NodeId artifact) {
        stubs.putIfAbsent(id, new StubNode(id, kind, name, null, artifact));
    }

    /** Every level of a dotted package name. */
    public void namespaceChain(String dottedName, NodeId artifact) {
        String current = dottedName;
        while (!current.isEmpty()) {
            NodeId id = JavaIds.namespace(current);
            int dot = current.lastIndexOf('.');
            String simpleName = dot < 0 ? current : current.substring(dot + 1);
            NamespaceStub stub = namespaces.computeIfAbsent(id, key -> new NamespaceStub(simpleName, new TreeSet<>()));
            if (artifact != null) stub.artifacts().add(artifact);
            current = dot < 0 ? "" : current.substring(0, dot);
        }
    }

    /** EXTENDS and IMPLEMENTS of a stubbed type. */
    public void baseEdge(Edge edge) {
        edges.add(edge);
    }

    public boolean contains(NodeId id) {
        return stubs.containsKey(id);
    }

    public List<StubNode> stubs() {
        List<StubNode> all = new ArrayList<>(stubs.values());
        namespaces.forEach((id, ns) -> all.add(new StubNode(id, StubKind.NAMESPACE, ns.name(), null, ns.artifacts().isEmpty() ? null : ns.artifacts().first())));
        return all;
    }

    public List<Edge> edges() {
        return edges;
    }
}
