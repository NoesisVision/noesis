package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.core.config.ScanConfig;
import vision.noesis.scanner.core.export.JsonGraphWriter;
import vision.noesis.scanner.core.model.BehaviourType;
import vision.noesis.scanner.core.model.EdgeType;
import vision.noesis.scanner.core.model.Graph;
import vision.noesis.scanner.core.model.Node;
import vision.noesis.scanner.core.model.NodeType;
import vision.noesis.scanner.core.model.PortDirection;

class JavaScannerTest {

    private static final String FIXTURE = "vision.noesis.scanner.core.fixture.order";
    private static final String HANDLE = FIXTURE + ".OrderApplicationService.handle(" + FIXTURE + ".PlaceOrder)";
    private static final String IS_PLACED = FIXTURE + ".OrderApplicationService.isPlaced(" + FIXTURE + ".OrderId)";
    private static final String PLACE = FIXTURE + ".Order.place(java.lang.String)";
    private static final String ON_ORDER_PLACED = FIXTURE + ".OrderNotifier.onOrderPlaced(" + FIXTURE + ".OrderPlaced)";
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
    void readsBehaviourTypeFromHandlerAnnotation() {
        assertEquals(BehaviourType.COMMAND, node(HANDLE).behaviourType());
        assertEquals(BehaviourType.COMMAND, node(PLACE).behaviourType());
        assertEquals(BehaviourType.QUERY, node(IS_PLACED).behaviourType());
        assertEquals(BehaviourType.EVENT, node(ON_ORDER_PLACED).behaviourType());
        assertEquals(BehaviourType.QUERY, node(FIXTURE + ".OrderRepository.exists(" + FIXTURE + ".OrderId)").behaviourType());
    }

    @Test
    void leavesBehavioursWithoutAnnotationUntyped() {
        assertNull(node(FIXTURE + ".InMemoryOrderRepository.save(" + FIXTURE + ".Order)").behaviourType());
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
    void skipsMethodsJavaWritesForEveryClassRecordAndEnum() {
        assertFalse(hasNode(FIXTURE + ".OrderId.value()"));
        assertFalse(hasNode(FIXTURE + ".Money.amount()"));
        assertFalse(hasNode(FIXTURE + ".Money.equals(java.lang.Object)"));
        assertFalse(hasNode(FIXTURE + ".Money.hashCode()"));
        assertFalse(hasNode(FIXTURE + ".Money.toString()"));
        assertFalse(hasNode(FIXTURE + ".Order.equals(java.lang.Object)"));
        assertFalse(hasNode(FIXTURE + ".Order.hashCode()"));
        assertFalse(hasNode(FIXTURE + ".OrderStatus.values()"));
        assertFalse(hasNode(FIXTURE + ".OrderStatus.valueOf(java.lang.String)"));
    }

    @Test
    void keepsDomainMethodsOfRecordsAndEnums() {
        assertEquals(NodeType.BEHAVIOUR, node(FIXTURE + ".Money.add(" + FIXTURE + ".Money)").type());
        assertEquals(NodeType.BEHAVIOUR, node(FIXTURE + ".OrderStatus.isFinal()").type());
    }

    @Test
    void derivesBehavioursWithInvokes() {
        assertEquals(NodeType.BEHAVIOUR, node(HANDLE).type());
        assertTrue(hasEdge(FIXTURE + ".OrderApplicationService", HANDLE, EdgeType.CONTAINS));
        assertTrue(hasEdge(HANDLE, PLACE, EdgeType.INVOKES));
    }

    @Test
    void derivesMessageEdges() {
        assertTrue(hasEdge(HANDLE, FIXTURE + ".PlaceOrder", EdgeType.HANDLES));
        assertTrue(hasEdge(ON_ORDER_PLACED, FIXTURE + ".OrderPlaced", EdgeType.HANDLES));
        assertTrue(hasEdge(PLACE, FIXTURE + ".OrderPlaced", EdgeType.SENDS));
    }

    @Test
    void handlesOnlyMessages() {
        assertFalse(hasEdge(IS_PLACED, FIXTURE + ".OrderId", EdgeType.HANDLES));
        assertFalse(hasEdge(FIXTURE + ".OrderRepository.save(" + FIXTURE + ".Order)", FIXTURE + ".Order", EdgeType.HANDLES));
    }

    @Test
    void handlesOnlyMessagesOfTheHandlersKind() {
        String publish = FIXTURE + ".OrderEventPublisher.publish(" + FIXTURE + ".OrderPlaced)";
        assertEquals(BehaviourType.COMMAND, node(publish).behaviourType());
        assertFalse(hasEdge(publish, FIXTURE + ".OrderPlaced", EdgeType.HANDLES));
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
        assertTrue(json.contains("\"behaviourType\" : \"COMMAND\""));
    }

    private static Node node(String id) {
        Optional<Node> found = graph.nodes().stream().filter(n -> n.id().equals(id)).findFirst();
        assertTrue(found.isPresent(), "missing node " + id);
        return found.orElseThrow();
    }

    private static boolean hasNode(String id) {
        return graph.nodes().stream().anyMatch(n -> n.id().equals(id));
    }

    private static boolean hasEdge(String from, String to, EdgeType type) {
        return graph.edges().stream()
                .anyMatch(e -> e.from().equals(from) && e.to().equals(to) && e.type() == type);
    }
}
