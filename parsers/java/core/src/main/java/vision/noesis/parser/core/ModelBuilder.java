package vision.noesis.parser.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.Generator;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.StubNode;

/** Collects what an engine finds in one artifact and builds the sorted model file. */
public final class ModelBuilder {

    private final Map<NodeId, DeclarationNode> nodes = new LinkedHashMap<>();
    private final List<Edge> edges = new ArrayList<>();
    private final StubRegistry stubs = new StubRegistry();
    private final List<Diagnostic> diagnostics = new ArrayList<>();

    /** The first declaration of an id wins; a second one is reported, not merged. */
    public void node(DeclarationNode node) {
        DeclarationNode existing = nodes.putIfAbsent(node.id(), node);
        if (existing != null) {
            diagnostics.add(Diagnostics.warning(Diagnostics.DUPLICATE_ID, "Declared twice: " + node.id() + "."));
        }
    }

    public boolean hasNode(NodeId id) {
        return nodes.containsKey(id);
    }

    public void edge(Edge edge) {
        edges.add(edge);
    }

    public StubRegistry stubs() {
        return stubs;
    }

    public void diagnostic(Diagnostic diagnostic) {
        diagnostics.add(diagnostic);
    }

    /** How much the builder holds now, so a failed step can be undone with {@link #rollback}. */
    public record Mark(int nodes, int edges, int diagnostics) {}

    public Mark mark() {
        return new Mark(nodes.size(), edges.size(), diagnostics.size());
    }

    /** Drops every node, edge and diagnostic added since the mark. Stubs stay: the closure adds them only at the end. */
    public void rollback(Mark mark) {
        int kept = 0;
        for (var iterator = nodes.keySet().iterator(); iterator.hasNext(); ) {
            iterator.next();
            if (kept++ >= mark.nodes()) iterator.remove();
        }
        edges.subList(mark.edges(), edges.size()).clear();
        diagnostics.subList(mark.diagnostics(), diagnostics.size()).clear();
    }

    /** Sorted file; stub artifacts no dependency lists are appended as libraries, platform ones as platform. */
    public CodeModelFile build(Generator generator, ArtifactNode artifact, ParseSession session) {
        List<StubNode> allStubs = stubs.stubs();
        TreeMap<NodeId, ArtifactDependency> dependencies = new TreeMap<>();
        artifact.dependencies().forEach(dependency -> dependencies.put(dependency.id(), dependency));
        for (StubNode stub : allStubs) {
            if (stub.artifact() != null && !dependencies.containsKey(stub.artifact())) {
                ArtifactKind kind = session.classpath().isPlatform(stub.artifact()) ? ArtifactKind.PLATFORM : ArtifactKind.LIBRARY;
                dependencies.put(stub.artifact(), new ArtifactDependency(stub.artifact(), kind, null));
            }
        }
        ArtifactNode withDependencies = new ArtifactNode(
                artifact.id(), artifact.kind(), artifact.name(), artifact.version(), artifact.rootDirectory(), artifact.target(),
                artifact.executable(), List.copyOf(dependencies.values()), artifact.annotations(), artifact.languageSpecific());
        List<Edge> allEdges = new ArrayList<>(edges);
        allEdges.addAll(stubs.edges());
        return CodeModelFile.sorted(generator, withDependencies, nodes.values(), allEdges, allStubs, diagnostics);
    }
}
