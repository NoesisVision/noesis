package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.StubNode;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.Visibility;

/** The facts the golden file is too large to review by eye, pinned one by one. */
class ModelFactsTest {

    private static final String SYNTAX = "vision.noesis.fixture.syntax.";

    private final CodeModelFile model = Fixtures.source().model("java-syntax");

    @Test
    void nestedAndGenericTypesSpellTheirPathWithPlusAndArity() {
        assertNotNull(node("T:" + SYNTAX + "generics.GenericTypes+GenericClassWithOneParameter`1+NestedGenericClass`1"));
        assertNotNull(node("T:" + SYNTAX + "types.LocalAndAnonymousClasses+1LocalRunnable"));
        TypeNode anonymous = (TypeNode) node("T:" + SYNTAX + "types.LocalAndAnonymousClasses+1");
        assertEquals("1", anonymous.name());
        assertEquals(Visibility.PRIVATE, anonymous.visibility());
        assertEquals("M:" + SYNTAX + "types.LocalAndAnonymousClasses#anonymousClass()", anonymous.languageSpecific().get("java.enclosingMethod"));
    }

    @Test
    void innerClassTypeParametersCountTheOuterOnesFirst() {
        TypeNode inner = (TypeNode) node("T:" + SYNTAX + "generics.GenericTypes+GenericClassWithOneParameter`1+NestedGenericClass`1");
        assertEquals(1, inner.typeParameters().get(0).ordinal());
        FieldNode map = (FieldNode) node("F:" + SYNTAX + "generics.GenericTypes+GenericClassWithOneParameter`1+NestedGenericClass`1.map");
        assertEquals("java.util.Map`2[!0,!1]", map.type().canonical());
        FieldNode raw = (FieldNode) node("F:" + SYNTAX + "generics.GenericTypes+WildcardUses.raw");
        assertEquals("java.util.List`1<>", raw.type().canonical());
    }

    @Test
    void implicitMembersAreGeneratedWithoutLocations() {
        MethodNode accessor = (MethodNode) node("M:" + SYNTAX + "types.RecordKinds+PlainRecord#id()");
        assertEquals(Origin.GENERATED, accessor.origin());
        assertTrue(accessor.locations().isEmpty());
        assertEquals(true, accessor.languageSpecific().get("java.isRecordComponent"));
        MethodNode explicit = (MethodNode) node("M:" + SYNTAX + "types.RecordKinds+RecordWithExplicitMembers#count()");
        assertEquals(Origin.DECLARED, explicit.origin());
        assertEquals(Origin.GENERATED, node("M:" + SYNTAX + "types.EnumKinds+PlainEnum#values()").origin());
    }

    @Test
    void visibilityAndModifiersFollowTheSharedVocabulary() {
        FieldNode packagePrivate = (FieldNode) node("F:" + SYNTAX + "members.FieldDeclarations.packagePrivateField");
        assertEquals(Visibility.NAMESPACE, packagePrivate.visibility());
        assertEquals(Visibility.PROTECTED_OR_NAMESPACE, ((FieldNode) node("F:" + SYNTAX + "members.FieldDeclarations.protectedField")).visibility());
        MethodNode nativeMethod = (MethodNode) node("M:" + SYNTAX + "members.MethodDeclarations#nativeMethod()");
        assertTrue(nativeMethod.modifiers().contains(Modifier.EXTERNAL));
        assertTrue(nativeMethod.bodiless());
        MethodNode defaultMethod = (MethodNode) node("M:" + SYNTAX + "types.InterfaceKinds+PlainInterface#defaultMethod()");
        assertFalse(defaultMethod.bodiless());
        assertEquals(List.of(Modifier.VIRTUAL), defaultMethod.modifiers());
        TypeNode record = (TypeNode) node("T:" + SYNTAX + "types.RecordKinds+PlainRecord");
        assertTrue(record.modifiers().containsAll(List.of(Modifier.FINAL, Modifier.RECORD)));
    }

    @Test
    void constantsAreFormattedFromTheirValues() {
        assertEquals("\"text with \\\"quotes\\\" and \\n newline1\"", ((FieldNode) node("F:" + SYNTAX + "members.FieldDeclarations.DERIVED_CONSTANT")).constantValue());
        assertEquals("2.5f", ((FieldNode) node("F:" + SYNTAX + "members.FieldDeclarations.FLOAT_CONSTANT")).constantValue());
        assertEquals(null, ((FieldNode) node("F:" + SYNTAX + "members.FieldDeclarations.NOT_A_CONSTANT")).constantValue());
    }

    @Test
    void constructorsChainExplicitlyAndImplicitly() {
        List<Edge.Invokes> fromGrandChild = invokesFrom("M:" + SYNTAX + "inheritance.ClassInheritance+GrandChild#.ctor()");
        assertEquals(1, fromGrandChild.size());
        assertEquals("M:" + SYNTAX + "inheritance.ClassInheritance+Derived#.ctor()", fromGrandChild.get(0).to().value());
        assertEquals(ExpressionKind.BASE, fromGrandChild.get(0).receiver());
        assertEquals(true, fromGrandChild.get(0).site().languageSpecific().get("java.implicitSuperCall"));
        List<Edge.Invokes> fromDerived = invokesFrom("M:" + SYNTAX + "inheritance.ClassInheritance+Derived#.ctor(java.lang.String)");
        Models.one(fromDerived, e -> e.receiver() == ExpressionKind.THIS && e.to().value().equals("M:" + SYNTAX + "inheritance.ClassInheritance+Derived#.ctor()"), "this()");
    }

    @Test
    void interfaceSlotsAreFilledByTheMemberThatOverridesThem() {
        List<Edge.ImplementsMember> edges = model.edges().stream().filter(Edge.ImplementsMember.class::isInstance).map(Edge.ImplementsMember.class::cast).collect(Collectors.toList());
        Edge.ImplementsMember throughBase = edges.stream().filter(e -> e.declaredOn().value().endsWith("DerivedImplementsThroughBase")).findFirst().orElseThrow();
        assertEquals("M:" + SYNTAX + "inheritance.InterfaceInheritance+BaseProvidesImplementation#first()", throughBase.from().value());
        // Second's default fills First#first() on Second itself, so ImplementsSecond, which inherits it, adds no edge for that slot.
        Models.one(edges, e -> e.from().value().equals("M:" + SYNTAX + "inheritance.InterfaceInheritance+Second#first()") && e.to().value().equals("M:" + SYNTAX + "inheritance.InterfaceInheritance+First#first()"), "slot filled by the default");
        assertTrue(edges.stream().noneMatch(e -> e.declaredOn().value().endsWith("ImplementsSecond") && e.to().value().endsWith("First#first()")), "an inherited default adds no slot edge on the implementing class");
        Edge.ImplementsMember money = edges.stream().filter(e -> e.declaredOn().value().endsWith("GenericInheritance+Money")).findFirst().orElseThrow();
        assertEquals("java.lang.Comparable`1[" + SYNTAX + "inheritance.GenericInheritance+Money]", money.interfaceType().canonical());
    }

    @Test
    void receiversAreClassified() {
        List<Edge.Invokes> calls = invokesFrom("M:" + SYNTAX + "invocations.InvocationForms#receivers(" + SYNTAX + "inheritance.ClassInheritance+Base)");
        List<ExpressionKind> receivers = calls.stream().map(Edge.Invokes::receiver).collect(Collectors.toList());
        assertEquals(17, receivers.size(), receivers.toString());
        Map<ExpressionKind, Integer> expected = Map.of(ExpressionKind.THIS, 3, ExpressionKind.BASE, 1, ExpressionKind.PARAMETER, 1, ExpressionKind.LOCAL, 3, ExpressionKind.FIELD, 2,
                ExpressionKind.TYPE, 2, ExpressionKind.CREATION, 1, ExpressionKind.RETURN_VALUE, 1, ExpressionKind.LITERAL, 1);
        expected.forEach((kind, count) -> assertEquals(count.intValue(), Collections.frequency(receivers, kind), kind.toString()));
        // The two constructor calls have no receiver.
        assertEquals(2, Collections.frequency(receivers, null), receivers.toString());
    }

    @Test
    void lambdaBodiesBelongToTheMemberViaClosure() {
        List<Edge.Invokes> calls = invokesFrom("M:" + SYNTAX + "invocations.InvocationForms#lambda()");
        assertTrue(calls.stream().anyMatch(e -> e.site().viaClosure() && e.to().value().endsWith("Base#overridable()")));
        assertTrue(calls.stream().anyMatch(e -> !e.site().viaClosure() && e.to().value().equals("M:java.lang.Runnable#run()")));
    }

    @Test
    void externalSymbolsAreStubbedWithTheirArtifact() {
        StubNode string = stub("T:java.lang.String");
        assertEquals("A:java.base@17", string.artifact().value());
        assertEquals("A:com.google.guava:guava@" + System.getProperty("noesis.version.guava"), stub("T:com.google.common.collect.ImmutableList`1").artifact().value());
        assertTrue(model.stubs().stream().noneMatch(s -> s.id().value().startsWith("T:vision.noesis.fixture.other.")), "sibling module types are never stubbed");
        assertTrue(model.edges().stream().anyMatch(e -> e instanceof Edge.Extends x && x.from().value().equals("T:java.lang.Integer") && x.to().canonical().equals("java.lang.Number")));
    }

    @Test
    void unresolvableWildcardsAreOtherReferences() {
        FieldNode covariant = (FieldNode) node("F:" + SYNTAX + "generics.GenericTypes+WildcardUses.covariant");
        TypeRef argument = ((TypeRef.Named) covariant.type()).typeArguments().get(0);
        assertTrue(argument instanceof TypeRef.Other other && other.text().equals("? extends java.lang.Number"), argument.toString());
    }

    private DeclarationNode node(String id) {
        return model.nodes().stream().filter(node -> node.id().equals(new NodeId(id))).findFirst().orElseThrow(() -> new AssertionError("No node " + id));
    }

    private StubNode stub(String id) {
        return model.stubs().stream().filter(stub -> stub.id().equals(new NodeId(id))).findFirst().orElseThrow(() -> new AssertionError("No stub " + id));
    }

    private List<Edge.Invokes> invokesFrom(String id) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast).filter(e -> e.from().value().equals(id)).collect(Collectors.toList());
    }
}
