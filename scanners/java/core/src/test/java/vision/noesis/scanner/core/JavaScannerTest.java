package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.core.config.ScanConfig;
import vision.noesis.scanner.core.export.JsonGraphWriter;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Graph;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;
import vision.noesis.scanner.core.model.PortDirection;

class JavaScannerTest {

    private static final String FIXTURE = "vision.noesis.scanner.core.fixture.order";
    private static Graph graph;

    @BeforeAll
    static void scanFixture() {
        graph = new JavaScanner().scan(ScanConfig.of(Path.of("target", "test-classes"), "core-test"));
    }

    @Test
    void detectsAnnotatedBlocksAndMessages() {
        assertEquals(NodeType.AGGREGATE_ROOT, node(FIXTURE + ".Order").type());
        assertEquals(NodeType.IDENTIFIER, node(FIXTURE + ".OrderId").type());
        assertEquals(NodeType.APPLICATION_SERVICE, node(FIXTURE + ".OrderApplicationService").type());
        assertEquals(NodeType.COMMAND, node(FIXTURE + ".PlaceOrder").type());
        assertEquals(NodeType.EVENT, node(FIXTURE + ".OrderPlaced").type());
    }

    @Test
    void readsPortDirectionFromAnnotationAttribute() {
        Node port = node(FIXTURE + ".OrderRepository");
        assertEquals(NodeType.PORT, port.type());
        assertEquals(PortDirection.SECONDARY, port.direction());
    }

    @Test
    void derivesModuleContainment() {
        assertEquals(NodeType.MODULE, node(FIXTURE).type());
        assertTrue(hasEdge(FIXTURE, FIXTURE + ".Order", EdgeType.CONTAINS));
        assertTrue(hasEdge(FIXTURE, FIXTURE + ".OrderRepository", EdgeType.EXPOSES));
    }

    @Test
    void derivesBehavioursWithInvokes() {
        String handle = FIXTURE + ".OrderApplicationService.handle(" + FIXTURE + ".PlaceOrder)";
        String place = FIXTURE + ".Order.place(java.lang.String)";
        assertEquals(NodeType.BEHAVIOUR, node(handle).type());
        assertTrue(hasEdge(FIXTURE + ".OrderApplicationService", handle, EdgeType.CONTAINS));
        assertTrue(hasEdge(handle, place, EdgeType.INVOKES));
    }

    @Test
    void derivesMessageEdges() {
        String handle = FIXTURE + ".OrderApplicationService.handle(" + FIXTURE + ".PlaceOrder)";
        String place = FIXTURE + ".Order.place(java.lang.String)";
        assertTrue(hasEdge(handle, FIXTURE + ".PlaceOrder", EdgeType.HANDLES));
        assertTrue(hasEdge(place, FIXTURE + ".OrderPlaced", EdgeType.SENDS));
    }

    @Test
    void derivesAdapterImplementsPort() {
        assertTrue(hasEdge(FIXTURE + ".InMemoryOrderRepository", FIXTURE + ".OrderRepository", EdgeType.IMPLEMENTS));
    }

    @Test
    void serializesToJson() {
        String json = new JsonGraphWriter().toJson(graph);
        assertTrue(json.contains("\"AGGREGATE_ROOT\""));
        assertTrue(json.contains("\"INVOKES\""));
    }

    private static Node node(String id) {
        Optional<Node> found = graph.nodes().stream().filter(n -> n.id().equals(id)).findFirst();
        assertTrue(found.isPresent(), "missing node " + id);
        return found.orElseThrow();
    }

    private static boolean hasEdge(String from, String to, EdgeType type) {
        return graph.edges().stream()
                .anyMatch(e -> e.from().equals(from) && e.to().equals(to) && e.type() == type);
    }
}
