package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.DeclarationNode;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.ExpressionKind;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.Origin;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeNode;

/**
 * The hybrid engine: the source model, plus what only the class files hold. On the syntax fixture (no annotation
 * processors) that is nothing, so the model is the source engine's; on the Lombok fixture it is the generated members
 * and the calls to them.
 */
class HybridEngineTest {

    private static final String MEMBERS = Models.LOMBOK + "GeneratedMembers";
    private static final String CALLERS = Models.LOMBOK + "GeneratedMemberCallers";

    // --- Syntax fixture: the source model, exactly ------------------------------------------------------------------

    @Test
    void onTheSyntaxFixtureTheHybridModelIsTheSourceModel() {
        for (CodeModelFile source : Fixtures.source().models()) {
            CodeModelFile hybrid = Fixtures.scan(EngineKind.HYBRID).model(source.artifact().name());
            assertEquals(source.nodes(), hybrid.nodes(), source.artifact().name() + " nodes");
            assertEquals(source.edges(), hybrid.edges(), source.artifact().name() + " edges");
            assertEquals(source.stubs(), hybrid.stubs(), source.artifact().name() + " stubs");
            assertEquals(source.diagnostics(), hybrid.diagnostics(), source.artifact().name() + " diagnostics");
            assertEquals(withEngine(source.artifact(), "hybrid"), hybrid.artifact(), source.artifact().name() + " artifact");
        }
    }

    @Test
    void theHybridArtifactNamesItsEngine() {
        assertEquals("hybrid", Models.lombok(EngineKind.HYBRID).artifact().languageSpecific().get("java.engine"));
        assertEquals("source", Models.lombok(EngineKind.SOURCE).artifact().languageSpecific().get("java.engine"));
        assertEquals("bytecode", Models.lombok(EngineKind.BYTECODE).artifact().languageSpecific().get("java.engine"));
    }

    // --- Lombok fixture: generated members --------------------------------------------------------------------------

    @Test
    void theSourceEngineLacksTheGeneratedMembersAndTheHybridEngineHasThem() {
        String getter = "M:" + MEMBERS + "+GetterSetter#getName()";
        String setter = "M:" + MEMBERS + "+GetterSetter#setCount(int)";
        String builder = "T:" + MEMBERS + "+Built+BuiltBuilder";
        String build = "M:" + MEMBERS + "+Built+BuiltBuilder#build()";
        String dataConstructor = "M:" + MEMBERS + "+DataHolder#.ctor(java.lang.String)";
        for (String id : List.of(getter, setter, builder, build, dataConstructor)) {
            assertFalse(Models.has(Models.lombok(EngineKind.SOURCE), id), id + " in the source model");
            assertTrue(Models.has(Models.lombok(EngineKind.BYTECODE), id), id + " in the bytecode model");
            assertTrue(Models.has(Models.lombok(EngineKind.HYBRID), id), id + " in the hybrid model");
        }
    }

    @Test
    void aGeneratedMemberIsGeneratedAndMarkedAsComingFromBytecode() {
        MethodNode getter = Models.node(Models.lombok(EngineKind.HYBRID), MethodNode.class, "M:" + MEMBERS + "+GetterSetter#getName()");
        assertEquals(Origin.GENERATED, getter.origin());
        assertEquals("bytecode", getter.languageSpecific().get("java.engine"));
        assertEquals("java.lang.String", getter.signature().returnType().canonical());
        TypeNode builder = Models.node(Models.lombok(EngineKind.HYBRID), TypeNode.class, "T:" + MEMBERS + "+Built+BuiltBuilder");
        assertEquals(Origin.GENERATED, builder.origin());
        assertEquals("bytecode", builder.languageSpecific().get("java.engine"));
        MethodNode written = Models.node(Models.lombok(EngineKind.HYBRID), MethodNode.class, "M:" + MEMBERS + "+GetterSetter#describe()");
        assertEquals(Origin.DECLARED, written.origin());
        assertNull(written.languageSpecific().get("java.engine"));
        assertTrue(written.documentation() != null && !written.documentation().isEmpty(), "source Javadoc kept");
    }

    @Test
    void aSourceDeclarationKeepsItsSourceFacts() {
        MethodNode caller = Models.node(Models.lombok(EngineKind.HYBRID), MethodNode.class, "M:" + CALLERS + "#accessorCalls()");
        assertEquals(Models.node(Models.lombok(EngineKind.SOURCE), MethodNode.class, caller.id().value()), caller);
        assertTrue(caller.locations().get(0).startColumn() > 0);
    }

    @Test
    void aGeneratedMemberIsContainedOverridesAndImplements() {
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        String type = "T:" + MEMBERS + "+DataHolder";
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.Contains c && c.from().value().equals(type) && c.to().value().equals("M:" + MEMBERS + "+DataHolder#equals(java.lang.Object)")));
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.Overrides o && o.from().value().equals("M:" + MEMBERS + "+DataHolder#toString()") && o.to().value().equals("M:java.lang.Object#toString()")));
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.ImplementsMember m && m.from().value().equals("M:" + MEMBERS + "+Delegating#size()") && m.to().value().equals("M:java.util.List`1#size()")));
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.Implements i && i.from().value().equals("T:" + MEMBERS + "+Delegating") && i.to().canonical().equals("java.util.List`1[java.lang.String]")));
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.Contains c && c.from().value().equals("T:" + MEMBERS + "+Built") && c.to().value().equals("T:" + MEMBERS + "+Built+BuiltBuilder")));
    }

    @Test
    void aDefaultConstructorTheProcessorReplacedIsDropped() {
        String implicit = "M:" + MEMBERS + "+Built#.ctor()";
        String generated = "M:" + MEMBERS + "+Built#.ctor(java.lang.String,int)";
        assertTrue(Models.has(Models.lombok(EngineKind.SOURCE), implicit), "javac assumes the default constructor");
        assertFalse(Models.has(Models.lombok(EngineKind.HYBRID), implicit));
        assertTrue(Models.has(Models.lombok(EngineKind.HYBRID), generated));
        assertTrue(Models.lombok(EngineKind.HYBRID).edges().stream().noneMatch(e -> e.from().value().equals(implicit) || e instanceof Edge.Contains c && c.to().value().equals(implicit)));
    }

    @Test
    void modifiersTheProcessorAddsAreTakenFromBytecodeAndMarked() {
        TypeNode value = Models.node(Models.lombok(EngineKind.HYBRID), TypeNode.class, "T:" + MEMBERS + "+ValueHolder");
        assertTrue(value.modifiers().contains(vision.noesis.scanner.model.Modifier.FINAL), value.modifiers().toString());
        assertEquals(true, value.languageSpecific().get("java.processorModified"));
        assertTrue(value.documentation() != null && !value.documentation().isEmpty(), "source Javadoc kept");
        vision.noesis.scanner.model.FieldNode name = Models.node(Models.lombok(EngineKind.HYBRID), vision.noesis.scanner.model.FieldNode.class, "F:" + MEMBERS + "+ValueHolder.name");
        assertEquals(vision.noesis.scanner.model.Visibility.PRIVATE, name.visibility());
        assertTrue(name.modifiers().contains(vision.noesis.scanner.model.Modifier.READONLY));
        assertNull(Models.node(Models.lombok(EngineKind.HYBRID), TypeNode.class, "T:" + MEMBERS + "+Plain").languageSpecific().get("java.processorModified"));
    }

    @Test
    void aCallJavacBoundToTheSupertypesMemberIsReboundToTheGeneratedOverride() {
        String caller = "M:" + CALLERS + "#comparedCalls()";
        assertEquals(1, Models.invokesTo(Models.lombok(EngineKind.SOURCE), caller, "M:java.lang.Object#equals(java.lang.Object)").size());
        assertTrue(Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, "M:java.lang.Object#equals(java.lang.Object)").isEmpty());
        assertEquals(1, Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, "M:" + MEMBERS + "+Compared#equals(java.lang.Object)").size());
        assertEquals(1, Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, "M:java.lang.String#equals(java.lang.Object)").size(), "a call on another receiver on the same line stays");
    }

    @Test
    void noStaticInitializerIsAddedToATypeTheSourceEngineDeclared() {
        assertTrue(Models.lombok(EngineKind.HYBRID).nodes().stream().noneMatch(n -> n.id().value().endsWith("#.cctor()")));
    }

    // --- Lombok fixture: calls to generated members -----------------------------------------------------------------

    @Test
    void aCallToAGeneratedMemberIsUnboundInSourceAndBoundInHybrid() {
        String caller = "M:" + CALLERS + "#accessorCalls()";
        String getter = "M:" + MEMBERS + "+GetterSetter#getName()";
        assertTrue(Models.invokesTo(Models.lombok(EngineKind.SOURCE), caller, getter).isEmpty());
        List<Edge.Invokes> calls = Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, getter);
        assertEquals(1, calls.size());
        Edge.Invokes call = calls.get(0);
        assertEquals("bytecode", call.site().languageSpecific().get("java.engine"));
        assertEquals(34, call.site().location().startLine());
        assertEquals(0, call.site().location().startColumn());
        assertEquals(ExpressionKind.OTHER, call.receiver());
    }

    @Test
    void theCallChainedAfterAGeneratedGetterComesFromBytecodeToo() {
        String caller = "M:" + CALLERS + "#accessorCalls()";
        String length = "M:java.lang.String#length()";
        assertTrue(Models.invokesTo(Models.lombok(EngineKind.SOURCE), caller, length).isEmpty(), "javac cannot type the receiver");
        List<Edge.Invokes> calls = Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, length);
        assertEquals(1, calls.size());
        assertEquals("bytecode", calls.get(0).site().languageSpecific().get("java.engine"));
    }

    @Test
    void aCallTheSourceEngineBoundStaysTheSourceEngines() {
        String caller = "M:" + CALLERS + "#plainCalls()";
        String getter = "M:" + MEMBERS + "+Plain#getName()";
        List<Edge.Invokes> source = Models.invokesTo(Models.lombok(EngineKind.SOURCE), caller, getter);
        List<Edge.Invokes> hybrid = Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, getter);
        assertEquals(source, hybrid);
        assertEquals(ExpressionKind.LOCAL, hybrid.get(0).receiver());
        assertTrue(hybrid.get(0).site().location().startColumn() > 0);
    }

    @Test
    void theBuilderChainIsBoundThroughGeneratedTypes() {
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        String caller = "M:" + CALLERS + "#builderCalls()";
        assertEquals(1, Models.invokesTo(hybrid, caller, "M:" + MEMBERS + "+Built#builder()").size());
        assertEquals(2, Models.invokesTo(hybrid, caller, "M:" + MEMBERS + "+Built+BuiltBuilder#count(int)").size());
        assertEquals(2, Models.invokesTo(hybrid, caller, "M:" + MEMBERS + "+Built+BuiltBuilder#build()").size());
        assertEquals(1, Models.invokesTo(hybrid, caller, "M:" + MEMBERS + "+Built#toBuilder()").size());
    }

    @Test
    void aGeneratedMembersOwnBodyComesFromBytecode() {
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        String getter = "M:" + MEMBERS + "+GetterSetter#getName()";
        List<Edge.Accesses> reads = hybrid.edges().stream().filter(Edge.Accesses.class::isInstance).map(Edge.Accesses.class::cast)
                .filter(a -> a.from().value().equals(getter)).collect(Collectors.toList());
        assertEquals(1, reads.size());
        assertEquals("F:" + MEMBERS + "+GetterSetter.name", reads.get(0).to().value());
        assertNull(reads.get(0).site().languageSpecific().get("java.engine"), "a body of an added member is not marked site by site; the member is");
    }

    @Test
    void theUnboundSiteDiagnosticsOfResolvedLinesAreDropped() {
        List<Diagnostic> source = Models.lombok(EngineKind.SOURCE).diagnostics().stream().filter(d -> d.code().equals(Diagnostics.UNBOUND_SITE)).collect(Collectors.toList());
        List<Diagnostic> hybrid = Models.lombok(EngineKind.HYBRID).diagnostics().stream().filter(d -> d.code().equals(Diagnostics.UNBOUND_SITE)).collect(Collectors.toList());
        assertTrue(source.size() >= 20, "the source engine reports every call to a generated member: " + source.size());
        assertTrue(hybrid.isEmpty(), () -> hybrid.size() + " unbound sites left: " + hybrid);
        List<Diagnostic> errors = Models.lombok(EngineKind.HYBRID).diagnostics().stream().filter(d -> d.code().startsWith("compiler.err")).collect(Collectors.toList());
        assertEquals(List.of("compiler.err.does.not.override.abstract"), errors.stream().map(Diagnostic::code).collect(Collectors.toList()), "only the error on the class line stays: " + errors);
    }

    @Test
    void everyCallOfAChainAfterAGeneratedGetterIsTakenWhateverLineItIsOn() {
        String caller = "M:" + CALLERS + "#multiLineChain()";
        for (String target : List.of("M:java.lang.String#chars()", "M:java.util.stream.IntStream#filter(java.util.function.IntPredicate)", "M:java.util.stream.IntStream#count()")) {
            assertTrue(Models.invokesTo(Models.lombok(EngineKind.SOURCE), caller, target).isEmpty(), target + " unbound in source");
            assertEquals(1, Models.invokesTo(Models.lombok(EngineKind.HYBRID), caller, target).size(), target);
        }
    }

    @Test
    void aStaticFieldBuiltByAGeneratedBuilderHoldsItsCalls() {
        String field = "F:" + CALLERS + ".DEFAULT";
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        assertEquals(1, Models.invokesTo(hybrid, field, "M:" + MEMBERS + "+Built#builder()").size());
        assertEquals(1, Models.invokesTo(hybrid, field, "M:" + MEMBERS + "+Built+BuiltBuilder#build()").size());
        assertTrue(hybrid.nodes().stream().noneMatch(n -> n.id().value().equals("M:" + CALLERS + "#.cctor()")), "no static initializer of a source type is added");
    }

    @Test
    void anInstanceFieldInitializerBelongsToTheFieldOnceNotToTheConstructor() {
        String field = "F:" + CALLERS + ".initialCount";
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        assertEquals(1, Models.invokesTo(hybrid, field, "M:" + MEMBERS + "+GetterSetter#getCount()").size());
        assertEquals(1, Models.invokesTo(hybrid, field, "M:" + MEMBERS + "+GetterSetter#.ctor()").size(), "the source engine's creation, not a second one from bytecode");
        String constructor = "M:" + CALLERS + "#.ctor()";
        assertTrue(Models.invokesTo(hybrid, constructor, "M:" + MEMBERS + "+GetterSetter#getCount()").isEmpty());
        assertTrue(hybrid.edges().stream().noneMatch(e -> e instanceof Edge.Accesses a && a.from().value().equals(constructor) && a.to().value().equals(field)),
                "the initializer's store into its own field is no access");
    }

    @Test
    void aMemberThatNamesAGeneratedTypeHasBytecodesIdAndKeepsItsSourceFacts() {
        String unresolved = "M:" + CALLERS + "#describeBuilder(<unresolved:vision.noesis.fixture.lombok.GeneratedMembers.Built.BuiltBuilder>)";
        String id = "M:" + CALLERS + "#describeBuilder(" + MEMBERS + "+Built+BuiltBuilder)";
        assertTrue(Models.has(Models.lombok(EngineKind.SOURCE), unresolved));
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        assertFalse(Models.has(hybrid, unresolved));
        MethodNode method = Models.node(hybrid, MethodNode.class, id);
        assertEquals(Origin.DECLARED, method.origin());
        assertTrue(method.documentation() != null && !method.documentation().isEmpty(), "source Javadoc kept");
        assertEquals(MEMBERS + "+Built+BuiltBuilder", method.signature().parameters().get(0).type().canonical());
        assertEquals("builder", method.signature().parameters().get(0).name());
        assertEquals(1, Models.invokesTo(hybrid, "M:" + CALLERS + "#callDescribeBuilder()", id).size(), "the call follows the id");
        assertEquals(1, Models.invokesTo(hybrid, id, "M:" + MEMBERS + "+Built+BuiltBuilder#build()").size());
        vision.noesis.scanner.model.FieldNode pending = Models.node(hybrid, vision.noesis.scanner.model.FieldNode.class, "F:" + CALLERS + ".pending");
        assertEquals(MEMBERS + "+Built+BuiltBuilder", pending.type().canonical());
    }

    @Test
    void aFieldOnlyBytecodeReachesIsStubbedWithItsType() {
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        String caller = "M:" + CALLERS + "#primitiveClassOnAnUnboundLine()";
        assertTrue(hybrid.edges().stream().anyMatch(e -> e instanceof Edge.Accesses a && a.from().value().equals(caller) && a.to().value().equals("F:java.lang.Integer.TYPE")),
                "int.class reads Integer.TYPE on the unbound line");
        assertTrue(hybrid.stubs().stream().anyMatch(s -> s.id().value().equals("F:java.lang.Integer.TYPE")));
        assertTrue(hybrid.stubs().stream().anyMatch(s -> s.id().value().equals("T:java.lang.Integer")));
    }

    // --- Lombok fixture: stubs ----------------------------------------------------------------------------------------

    @Test
    void stubsReachedOnlyThroughGeneratedMembersAreAddedWithTheirContainers() {
        CodeModelFile source = Models.lombok(EngineKind.SOURCE);
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        Set<NodeId> sourceStubs = source.stubs().stream().map(StubNode::id).collect(Collectors.toSet());
        assertTrue(hybrid.stubs().stream().map(StubNode::id).collect(Collectors.toSet()).containsAll(sourceStubs));
        for (StubNode stub : hybrid.stubs()) {
            if (stub.id().value().contains("#")) {
                NodeId type = new NodeId("T:" + stub.id().canonicalPath().substring(0, stub.id().canonicalPath().indexOf('#')));
                assertTrue(hybrid.stubs().stream().anyMatch(s -> s.id().equals(type)), stub.id() + " without " + type);
            }
        }
        Set<String> dependencies = hybrid.artifact().dependencies().stream().map(d -> d.id().value()).collect(Collectors.toSet());
        for (StubNode stub : hybrid.stubs()) assertTrue(dependencies.contains(stub.artifact().value()), stub.id() + " -> " + stub.artifact());
        assertEquals(hybrid.stubs().stream().map(StubNode::id).sorted().collect(Collectors.toList()), hybrid.stubs().stream().map(StubNode::id).collect(Collectors.toList()));
    }

    @Test
    void everyEdgeOfTheHybridModelHasKnownEnds() {
        CodeModelFile hybrid = Models.lombok(EngineKind.HYBRID);
        Set<String> known = hybrid.nodes().stream().map(n -> n.id().value()).collect(Collectors.toSet());
        hybrid.stubs().forEach(s -> known.add(s.id().value()));
        known.add(hybrid.artifact().id().value());
        for (Edge edge : hybrid.edges()) {
            assertTrue(known.contains(edge.from().value()), "from " + edge.from());
            NodeId to = null;
            if (edge instanceof Edge.Contains e) to = e.to();
            else if (edge instanceof Edge.Overrides e) to = e.to();
            else if (edge instanceof Edge.ImplementsMember e) to = e.to();
            else if (edge instanceof Edge.Invokes e) to = e.to();
            else if (edge instanceof Edge.Accesses e) to = e.to();
            if (to != null) assertTrue(known.contains(to.value()), "to " + to + " of " + edge);
        }
    }

    private static ArtifactNode withEngine(ArtifactNode artifact, String engine) {
        java.util.Map<String, Object> bag = new java.util.LinkedHashMap<>(artifact.languageSpecific().entries());
        bag.put("java.engine", engine);
        return new ArtifactNode(artifact.id(), artifact.kind(), artifact.name(), artifact.version(), artifact.rootDirectory(), artifact.target(), artifact.executable(), artifact.dependencies(), artifact.annotations(), vision.noesis.scanner.model.LanguageBag.of(bag));
    }
}
