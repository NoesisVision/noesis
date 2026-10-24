package vision.noesis.parser.model;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/** One artifact: its declarations (sorted by id), edges (sorted by kind, from, target, location) and stubs. */
public record CodeModelFile(
        int schemaVersion,
        Generator generator,
        ArtifactNode artifact,
        List<DeclarationNode> nodes,
        List<Edge> edges,
        List<StubNode> stubs,
        List<Diagnostic> diagnostics) {

    public static CodeModelFile sorted(
            Generator generator,
            ArtifactNode artifact,
            Collection<DeclarationNode> nodes,
            Collection<Edge> edges,
            Collection<StubNode> stubs,
            Collection<Diagnostic> diagnostics) {
        return new CodeModelFile(
                ParseManifest.CURRENT_SCHEMA_VERSION,
                generator,
                artifact,
                sortedBy(nodes, Comparator.comparing(DeclarationNode::id)),
                sortedBy(edges, EdgeOrdering.COMPARATOR),
                sortedBy(stubs, Comparator.comparing(StubNode::id)),
                sortedBy(diagnostics, Diagnostic.ORDER));
    }

    private static <T> List<T> sortedBy(Collection<T> items, Comparator<T> order) {
        List<T> sorted = new ArrayList<>(items);
        sorted.sort(order);
        return List.copyOf(sorted);
    }
}
