package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.LanguageBag;
import vision.noesis.scanner.model.NamespaceNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.Origin;

class ModelBuilderTest {

    @Test
    void aRollbackDropsWhatWasAddedSinceTheMarkAndKeepsWhatCameBefore() {
        ModelBuilder builder = new ModelBuilder();
        NodeId kept = new NodeId("N:kept");
        NodeId dropped = new NodeId("N:dropped");
        builder.node(namespace(kept));
        builder.edge(new Edge.Contains(new NodeId("N:"), kept));
        builder.diagnostic(Diagnostics.warning("NS0000", "kept"));

        ModelBuilder.Mark mark = builder.mark();
        builder.node(namespace(dropped));
        // A second declaration of a kept id adds only a diagnostic, which goes too.
        builder.node(namespace(kept));
        builder.edge(new Edge.Contains(kept, dropped));
        builder.diagnostic(Diagnostics.warning("NS0000", "dropped"));
        builder.rollback(mark);

        assertTrue(builder.hasNode(kept));
        assertFalse(builder.hasNode(dropped));
        assertEquals(new ModelBuilder.Mark(1, 1, 1), builder.mark());
    }

    private static NamespaceNode namespace(NodeId id) {
        return new NamespaceNode(id, id.value(), Origin.DECLARED, List.of(), List.of(), null, LanguageBag.EMPTY);
    }
}
