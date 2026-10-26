package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.parser.core.Models.SYNTAX;
import static vision.noesis.parser.core.Models.access;
import static vision.noesis.parser.core.Models.count;
import static vision.noesis.parser.core.Models.one;
import static vision.noesis.parser.core.Models.to;
import static vision.noesis.parser.core.Models.typeArguments;
import static vision.noesis.parser.model.ExpressionKind.BASE;
import static vision.noesis.parser.model.ExpressionKind.CREATION;
import static vision.noesis.parser.model.ExpressionKind.FIELD;
import static vision.noesis.parser.model.ExpressionKind.LOCAL;
import static vision.noesis.parser.model.ExpressionKind.OTHER;
import static vision.noesis.parser.model.ExpressionKind.PARAMETER;
import static vision.noesis.parser.model.ExpressionKind.RETURN_VALUE;
import static vision.noesis.parser.model.ExpressionKind.THIS;
import static vision.noesis.parser.model.ExpressionKind.TYPE;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.InvocationKind;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.SourceSpan;

/** Constructor calls and chains, statement contexts, async calls and initializers in {@code InvocationForms}, and the entry point {@code Program.main} that runs them. */
class ConstructorAndStatementFactsTest {

    private static final String FORMS = SYNTAX + "invocations.InvocationForms";
    private static final String TARGET = SYNTAX + "invocations.InvocationTarget";
    private static final String BASE_TYPE = SYNTAX + "inheritance.ClassInheritance+Base";
    private static final String INSTANCE = "M:" + TARGET + "#instanceMethod()";
    private static final String STATIC = "M:" + TARGET + "#staticMethod()";

    private static List<Edge.Invokes> invokes(EngineKind engine, String member) {
        return Models.invokes(Models.syntax(engine), "M:" + FORMS + "#" + member);
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constructorCallsTargetTheConstructorAndNothingElse(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "constructorInvocations()");
        assertEquals(2, count(calls, to("M:" + TARGET + "#.ctor()", null)));
        one(calls, to("M:" + TARGET + "#.ctor(int)", null), "new InvocationTarget(1)");
        one(calls, to("M:" + TARGET + "+GenericStaticClassForInvocations`1+NestedInstantiable#.ctor()", null), "nested type of a generic class");
        one(calls, to("M:java.util.ArrayList`1#.ctor(int)", null), "new ArrayList<InvocationTarget>(1)");
        String generics = "M:" + SYNTAX + "generics.GenericTypes+GenericClassWithOneParameter`1";
        one(calls, to(generics + "+StaticNestedGeneric`1#.ctor()", null), "static nested generic");
        one(calls, to(generics + "#.ctor()", null), "diamond creation");
        one(calls, to(generics + "+NestedGenericClass`1#.ctor()", null), "outer.new NestedGenericClass<String>()");
        one(calls, to("M:" + FORMS + "+ChainedConstructors#.ctor()", null), "new ChainedConstructors()");
        one(calls, to("M:" + FORMS + "+SuperChainedConstructor#.ctor()", null), "new SuperChainedConstructor()");
        one(calls, to("M:" + FORMS + "#createViaSupplier`1(java.util.function.Supplier`1[!!0])", TYPE), "InvocationTarget::new is no call");
        assertTrue(calls.stream().filter(edge -> edge.to().value().contains("#.ctor(")).allMatch(edge -> edge.invocationKind() == InvocationKind.CALL));
        assertTrue(Models.usesTypes(Models.syntax(engine), "M:" + FORMS + "#constructorInvocations()").isEmpty(), "a class creation is no type use");
    }

    @ParameterizedTest
    @EnumSource(value = EngineKind.class, names = {"SOURCE", "HYBRID"})
    void constructorCallsCarryTheTypeArgumentsOfTheCreatedType(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "constructorInvocations()");
        String generics = "M:" + SYNTAX + "generics.GenericTypes+GenericClassWithOneParameter`1";
        assertEquals(List.of(TARGET), typeArguments(one(calls, to("M:java.util.ArrayList`1#.ctor(int)"), "ArrayList")));
        assertEquals(List.of("java.lang.Integer"), typeArguments(one(calls, to(generics + "+StaticNestedGeneric`1#.ctor()"), "StaticNestedGeneric")));
        assertEquals(List.of("java.lang.Integer"), typeArguments(one(calls, to(generics + "#.ctor()"), "diamond")));
        assertEquals(List.of("java.lang.Integer", "java.lang.String"), typeArguments(one(calls, to(generics + "+NestedGenericClass`1#.ctor()"), "inner of outer")));
        assertEquals(List.of(TARGET), typeArguments(one(calls, to("M:" + FORMS + "#createViaSupplier`1(java.util.function.Supplier`1[!!0])"), "createViaSupplier")));
        assertTrue(calls.stream().filter(edge -> edge.to().value().startsWith("M:" + TARGET + "#.ctor(")).allMatch(edge -> edge.typeArguments().isEmpty()));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constructorsChainThroughThisAndSuper(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Edge.Invokes> chained = Models.invokes(model, "M:" + FORMS + "+ChainedConstructors#.ctor()");
        assertEquals(2, chained.size());
        one(chained, to("M:" + FORMS + "+ChainedConstructors#.ctor(int)", THIS), "this(...)");
        one(chained, to(STATIC, TYPE), "argument of this(...)");
        one(Models.invokes(model, "M:" + FORMS + "+ChainedConstructors#.ctor(int)"), to("M:java.lang.Object#.ctor()", BASE), "implicit super()");
        List<Edge.Invokes> superChained = Models.invokes(model, "M:" + FORMS + "+SuperChainedConstructor#.ctor()");
        assertEquals(2, superChained.size());
        one(superChained, to("M:" + BASE_TYPE + "#.ctor(int)", BASE), "super(...)");
        one(superChained, to(STATIC, TYPE), "argument of super(...)");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void statementContextsAllAttributeToTheMethod(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "statementContexts()");
        assertEquals(13, count(calls, to(INSTANCE)));
        one(calls, to("M:" + FORMS + "#createResource()", TYPE), "try-with-resources initializer");
        one(calls, to("M:" + FORMS + "#throwingMethod()", TYPE), "try body");
        one(calls, to("M:" + FORMS + "#createException()", TYPE), "throw expression");
        one(calls, to("M:java.util.Objects#equals(java.lang.Object,java.lang.Object)", TYPE), "if condition");
        one(calls, to("M:java.lang.Object#getClass()"), "catch body");
        one(calls, to(STATIC, TYPE), "switch expression default arm");
        assertEquals(2, count(calls, to("M:" + TARGET + "#returnsSelf()")));
        assertEquals(2, count(calls, to("M:" + TARGET + "#returnsList()")));
        one(Models.usesTypes(Models.syntax(engine), "M:" + FORMS + "#statementContexts()"), edge -> edge.to().canonical().equals(TARGET), "instanceof in a local initializer");
    }

    @Test
    void compoundAssignmentsAreOneReadWriteInSourceAndTwoAccessesInBytecode() {
        for (EngineKind engine : List.of(EngineKind.SOURCE, EngineKind.HYBRID)) {
            List<Edge.Accesses> source = Models.accesses(Models.syntax(engine), "M:" + FORMS + "#statementContexts()");
            assertEquals(6, count(source, access("F:" + FORMS + ".counter", AccessKind.READ_WRITE).and(edge -> edge.receiver() == THIS)), engine.id());
            assertEquals(6, count(source, edge -> edge.to().value().equals("F:" + FORMS + ".counter")), engine.id());
        }
        List<Edge.Accesses> bytecode = Models.accesses(Models.syntax(EngineKind.BYTECODE), "M:" + FORMS + "#statementContexts()");
        assertEquals(6, count(bytecode, access("F:" + FORMS + ".counter", AccessKind.READ)));
        assertEquals(6, count(bytecode, access("F:" + FORMS + ".counter", AccessKind.WRITE)));
        assertTrue(Models.edges(Models.syntax(EngineKind.BYTECODE), Edge.Accesses.class).noneMatch(edge -> edge.access() == AccessKind.READ_WRITE));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void asyncCallsAreOrdinaryCallsOnFutures(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "asyncInvocations()");
        assertEquals(6, count(calls, to("M:java.util.concurrent.CompletableFuture`1#join()")));
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#supplyAsync`1(java.util.function.Supplier`1[!!0])", TYPE), "supplyAsync");
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#thenApply`1(java.util.function.Function`2[<other:? super !0>,<other:? extends !!0>])"), "thenApply");
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#allOf(java.util.concurrent.CompletableFuture`1[<other:?>][])", TYPE), "allOf");
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#runAsync(java.lang.Runnable)", TYPE), "runAsync");
        assertEquals(5, count(calls, to("M:" + TARGET + "#returnsFuture()")));
        assertEquals(4, count(calls, to(INSTANCE)));
        assertEquals(2, count(calls, to(INSTANCE).and(edge -> edge.site().viaClosure())));
        if (engine != EngineKind.BYTECODE) {
            one(calls, to(INSTANCE, PARAMETER).and(edge -> edge.site().viaClosure()), "thenApply lambda parameter");
            one(calls, to(INSTANCE, LOCAL).and(edge -> edge.site().viaClosure()), "captured local in the runAsync lambda");
            assertEquals(2, count(calls, edge -> typeArguments(edge).equals(List.of("java.lang.Integer"))));
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void arrayMembersAreCloneCallsAndNoLengthAccess(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(2, count(invokes(engine, "arrayMembers()"), to("M:java.lang.Object#clone()")));
        List<Edge.Accesses> accesses = Models.accesses(model, "M:" + FORMS + "#arrayMembers()");
        assertEquals(2, accesses.size());
        assertTrue(accesses.stream().allMatch(edge -> edge.to().value().equals("F:" + FORMS + ".numbers")), accesses.toString());
    }

    @Test
    void fieldInitializerCallsBelongToTheFieldInSourceAndToTheConstructorInBytecode() {
        String initializers = FORMS + "+InvocationsFromInitializers";
        for (EngineKind engine : List.of(EngineKind.SOURCE, EngineKind.HYBRID)) {
            CodeModelFile source = Models.syntax(engine);
            one(Models.invokes(source, "F:" + initializers + ".fromFieldInitializer"), to(STATIC, TYPE), engine.id() + " field initializer");
            assertTrue(Models.invokes(source, "M:" + initializers + "#.ctor(" + TARGET + ")").stream().noneMatch(to(STATIC)), engine.id());
        }
        CodeModelFile bytecode = Models.syntax(EngineKind.BYTECODE);
        assertTrue(Models.invokes(bytecode, "F:" + initializers + ".fromFieldInitializer").isEmpty());
        one(Models.invokes(bytecode, "M:" + initializers + "#.ctor(" + TARGET + ")"), to(STATIC, TYPE), "field initializer compiled into the constructor");
        one(Models.accesses(bytecode, "M:" + initializers + "#.ctor(" + TARGET + ")"), access("F:" + initializers + ".fromFieldInitializer", AccessKind.WRITE), "initializer write");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void recordComponentsAndConstructorAssignedFieldsAreFieldReceivers(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String initializers = FORMS + "+InvocationsFromInitializers";
        for (String member : List.of("+RecordInvokingOnComponent#fromComponent()", "#fromConstructorParameter()")) {
            List<Edge.Invokes> calls = Models.invokes(model, "M:" + initializers + member);
            assertEquals(2, calls.size());
            one(calls, to("M:" + TARGET + "#returnsSelf()", engine != EngineKind.BYTECODE ? FIELD : OTHER), member + " on the field");
            one(calls, to(INSTANCE, engine != EngineKind.BYTECODE ? RETURN_VALUE : OTHER), member + " chained");
        }
        one(Models.accesses(model, "M:" + initializers + "#fromField()"), access("F:" + initializers + ".fromFieldInitializer", AccessKind.READ), "field read");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void mainRunsTheFormsAndExits(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String main = "M:" + SYNTAX + "Program#main(java.lang.String[])";
        assertEquals(List.of(Modifier.STATIC), Models.method(model, SYNTAX + "Program#main(java.lang.String[])").modifiers());
        List<Edge.Invokes> calls = Models.invokes(model, main);
        // Bytecode adds the Integer.valueOf boxing inside the supplyAsync lambda.
        assertEquals(engine == EngineKind.BYTECODE ? 13 : 12, calls.size(), calls.toString());
        one(calls, to("M:java.io.PrintStream#println(java.lang.String)"), "println");
        one(Models.accesses(model, main), access("F:java.lang.System.out", AccessKind.READ).and(edge -> edge.receiver() == TYPE), "System.out");
        one(calls, to("M:" + FORMS + "#.ctor()", null), "new InvocationForms()");
        one(calls, to("M:" + FORMS + "#allInvocationForms()"), "allInvocationForms()");
        one(calls, to("M:" + SYNTAX + "localvariables.LocalVariableForms#.ctor()", null), "new LocalVariableForms()");
        one(calls, to("M:" + SYNTAX + "localvariables.LocalVariableForms#allLocalVariableForms()"), "allLocalVariableForms()");
        one(calls, to("M:" + SYNTAX + "localvariables.LocalVariableForms#asyncLocalVariableForms()"), "asyncLocalVariableForms()");
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#supplyAsync`1(java.util.function.Supplier`1[!!0])", TYPE), "supplyAsync");
        one(calls, to("M:" + SYNTAX + "Program#localFunctionInTopLevelStatements(int)", TYPE).and(edge -> edge.site().viaClosure()), "static call inside the lambda");
        Edge.Invokes join = one(calls, to("M:java.util.concurrent.CompletableFuture`1#join()"), "join on the future");
        assertTrue(join.site().location().file().endsWith("/syntax/Program.java"), join.site().location().toString());
        assertEquals(21, join.site().location().startLine());
        one(calls, to("M:java.lang.System#exit(int)", TYPE), "System.exit");
        one(calls, to("M:" + SYNTAX + "types.ClassKinds+PlainClass#.ctor()", null), "new PlainClass()");
        one(calls, to("M:java.lang.Object#toString()"), "toString on the creation");
        if (engine != EngineKind.BYTECODE) {
            one(calls, to("M:java.io.PrintStream#println(java.lang.String)", FIELD), "println receiver");
            one(calls, to("M:" + FORMS + "#allInvocationForms()", LOCAL), "local receiver");
            one(calls, to("M:java.lang.Object#toString()", CREATION), "creation receiver");
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void everySiteIsLocatedInsideTheMemberAndTheEdgesAreSorted(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String member = "M:" + FORMS + "#instanceReceivers(java.lang.Object)";
        SourceSpan span = Models.method(model, FORMS + "#instanceReceivers(java.lang.Object)").locations().get(0);
        assertEquals("code-parsers/java/test-fixtures/java-syntax/src/main/java/vision/noesis/fixture/syntax/invocations/InvocationForms.java", span.file());
        Stream.of(Models.invokes(model, member).stream().map(Edge.Invokes::site), Models.accesses(model, member).stream().map(Edge.Accesses::site), Models.usesTypes(model, member).stream().map(Edge.UsesType::site)).flatMap(sites -> sites).forEach(site -> {
            assertEquals(span.file(), site.location().file());
            assertTrue(site.location().startLine() >= span.startLine(), site.location().toString());
            // Bytecode spans a member by its first line only, so only the other engines bound the site by the member's end.
            if (engine != EngineKind.BYTECODE) assertTrue(site.location().endLine() <= span.endLine(), site.location().toString());
            assertEquals(engine != EngineKind.BYTECODE, site.location().startColumn() >= 1, site.location().toString());
        });
        // Bytecode adds the Integer.valueOf / intValue boxing calls.
        assertEquals(engine == EngineKind.BYTECODE ? 68 : 66, Models.invokes(model, member).size(), "calls from instanceReceivers");
        CodeModelFile resorted = CodeModelFile.sorted(model.generator(), model.artifact(), model.nodes(), model.edges(), model.stubs(), model.diagnostics());
        assertEquals(resorted.edges(), model.edges());
    }
}
