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
import static vision.noesis.parser.model.ExpressionKind.LITERAL;
import static vision.noesis.parser.model.ExpressionKind.LOCAL;
import static vision.noesis.parser.model.ExpressionKind.OTHER;
import static vision.noesis.parser.model.ExpressionKind.PARAMETER;
import static vision.noesis.parser.model.ExpressionKind.RETURN_VALUE;
import static vision.noesis.parser.model.ExpressionKind.THIS;
import static vision.noesis.parser.model.ExpressionKind.TYPE;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.InvocationKind;
import vision.noesis.parser.model.TypeRef;

/** Every invocation form of {@code InvocationForms}, pinned the way the .NET parser's InvocationTests pin theirs. */
class InvocationFactsTest {

    private static final String FORMS = SYNTAX + "invocations.InvocationForms";
    private static final String TARGET = SYNTAX + "invocations.InvocationTarget";
    private static final String BASE_TYPE = SYNTAX + "inheritance.ClassInheritance+Base";
    private static final String INSTANCE = "M:" + TARGET + "#instanceMethod()";
    private static final String STATIC = "M:" + TARGET + "#staticMethod()";
    private static final String STATIC_GENERIC = "M:" + TARGET + "#staticGenericMethod`1(!!0)";
    private static final String GENERIC_INSTANCE = "M:" + TARGET + "#genericInstanceMethod`1(!!0)";
    private static final String WITH_ARGUMENTS = "M:" + TARGET + "#instanceMethodWithArguments(int,java.lang.String,int[])";
    private static final String MAP = "M:java.util.stream.Stream`1#map`1(java.util.function.Function`2[<other:? super !0>,<other:? extends !!0>])";
    private static final String COLLECT = "M:java.util.stream.Stream`1#collect`2(java.util.stream.Collector`3[<other:? super !0>,!!1,!!0])";
    private static final String GET_METHOD = "M:java.lang.Class`1#getMethod(java.lang.String,java.lang.Class`1[<other:?>][])";
    private static final String INVOKE = "M:java.lang.reflect.Method#invoke(java.lang.Object,java.lang.Object[])";
    private static final String LOCAL_FUNCTIONS = FORMS + "+1LocalFunctions";

    private static List<Edge.Invokes> invokes(EngineKind engine, String member) {
        return Models.invokes(Models.syntax(engine), "M:" + FORMS + "#" + member);
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void staticCallsHaveATypeReceiverHoweverTheTypeIsSpelt(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "staticInvocations()");
        assertEquals(2, count(calls, to(STATIC, TYPE)));
        assertEquals(2, count(calls, to(STATIC_GENERIC, TYPE)));
        assertEquals(2, count(calls, to("M:" + FORMS + "#staticMethodOnThisClass()", TYPE)));
        assertEquals(2, count(calls, to("M:" + BASE_TYPE + "#staticMethod()", TYPE)));
        one(calls, to("M:" + TARGET + "#staticFactory()", TYPE), "static import");
        one(calls, to("M:" + TARGET + "+NestedStaticHolder#nestedStaticMethod()", TYPE), "static on a nested type");
        one(calls, to("M:" + TARGET + "+NestedStaticHolder+DoublyNested#doublyNestedStaticMethod()", TYPE), "static on a doubly nested type");
        one(calls, to("M:" + SYNTAX + "types.InterfaceKinds+PlainInterface#staticMethod()", TYPE), "interface static");
        one(calls, to("M:" + TARGET + "+GenericStaticClassForInvocations`1#staticOnGenericClass()", TYPE), "static on a generic class");
        one(calls, to("M:" + Models.OTHER + "OtherConstants#staticMethodFromOtherModule()", TYPE), "static from the other module");
        one(calls, to("M:" + Models.OTHER + "OtherClass#create()", TYPE), "factory from the other module");
        one(calls, to("M:java.lang.Math#max(int,int)", TYPE), "platform static");
        one(calls, to("M:java.lang.Integer#parseInt(java.lang.String)", TYPE), "static on a boxed keyword type");
        one(calls, to("M:java.lang.String#join(java.lang.CharSequence,java.lang.CharSequence[])", TYPE), "String.join");
        assertTrue(calls.stream().allMatch(edge -> edge.invocationKind() == InvocationKind.CALL));
    }

    @Test
    void staticGenericTypeArgumentsAreInferredOrExplicit() {
        List<Edge.Invokes> calls = invokes(EngineKind.SOURCE, "staticInvocations()");
        one(calls, edge -> edge.to().value().equals(STATIC_GENERIC) && typeArguments(edge).equals(List.of("java.lang.Integer")), "inferred static generic");
        one(calls, edge -> edge.to().value().equals(STATIC_GENERIC) && typeArguments(edge).equals(List.of("java.lang.String")), "explicit static generic");
        one(calls, to("M:java.io.PrintStream#println(java.lang.String)", FIELD), "println on System.out");
    }

    @Test
    void bytecodeHasNoTypeArgumentsOnCalls() {
        assertTrue(Models.edges(Models.syntax(EngineKind.BYTECODE), Edge.Invokes.class).allMatch(edge -> edge.typeArguments().isEmpty()));
    }

    @Test
    void instanceReceiversAreClassifiedByWhatTheySpell() {
        List<Edge.Invokes> calls = invokes(EngineKind.SOURCE, "instanceReceivers(java.lang.Object)");
        assertEquals(2, count(calls, to("M:" + FORMS + "#instanceMethodOnThisClass()", THIS)));
        one(calls, to("M:" + BASE_TYPE + "#overridable()", BASE), "super.overridable()");
        one(calls, to("M:" + BASE_TYPE + "#overridable()", THIS), "overridable() via implicit this");
        one(calls, to("M:" + BASE_TYPE + "#overridable()", LOCAL), "overridable() on a base-typed local");
        one(calls, to("M:" + BASE_TYPE + "#finalMethod()", THIS), "inherited final method");
        one(calls, to("M:" + BASE_TYPE + "#protectedMethod()", THIS), "inherited protected method");
        assertEquals(2, count(calls, to(INSTANCE, LOCAL)));
        assertEquals(7, count(calls, to(INSTANCE, FIELD)));
        assertEquals(2, count(calls, to(INSTANCE, CREATION)));
        assertEquals(5, count(calls, to(INSTANCE, RETURN_VALUE)));
        assertEquals(2, count(calls, to(INSTANCE, OTHER)));
        one(calls, to(INSTANCE, PARAMETER), "((InvocationTarget) objectReference).instanceMethod()");
        one(calls, to("M:" + SYNTAX + "types.InterfaceKinds+PlainInterface#abstractMethod()", LOCAL), "call through an interface reference");
        one(calls, to("M:" + SYNTAX + "types.InterfaceKinds+PlainInterface#defaultMethod()", LOCAL), "default method on a local");
        one(calls, to("M:" + SYNTAX + "types.InterfaceKinds+PlainInterface#defaultMethod()", CREATION), "default method on a cast creation");
        one(calls, to("M:java.lang.Integer#toString()", LOCAL), "toString on a boxed local");
        one(calls, to("M:java.lang.String#toUpperCase()", LITERAL), "toUpperCase on a literal");
        one(calls, to("M:java.lang.String#toUpperCase()", RETURN_VALUE), "toUpperCase on a record accessor");
        one(calls, to("M:java.lang.Enum`1#name()", FIELD), "name() on an enum constant");
        one(calls, to("M:java.lang.Object#toString()", PARAMETER), "toString on the Object parameter");
        assertEquals(2, count(calls, to("M:" + BASE_TYPE + "#toString()", THIS)));
        one(calls, to("M:java.lang.Object#getClass()", THIS), "getClass() via implicit this");
        one(calls, to("M:java.lang.Class`1#getName()", RETURN_VALUE), "getClass().getName()");
        one(calls, to("M:java.lang.Class`1#getName()", LITERAL), "Integer.class.getName()");
        one(calls, to("M:" + SYNTAX + "types.RecordKinds+PlainRecord#name()", CREATION), "record accessor on a creation");
        assertEquals(2, count(calls, to("M:" + TARGET + "#returnsSelf()", LOCAL)));
        assertEquals(2, count(calls, to("M:" + TARGET + "#returnsSelf()", RETURN_VALUE)));
        one(calls, to("M:" + TARGET + "#staticFactory()", TYPE), "static factory as receiver");
        assertEquals(3, count(calls, to("M:java.lang.String#valueOf(int)", TYPE)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void instanceCallsTargetTheSameMethodsInBothEngines(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "instanceReceivers(java.lang.Object)");
        assertEquals(19, count(calls, to(INSTANCE)));
        assertEquals(4, count(calls, to("M:" + TARGET + "#returnsSelf()")));
        assertEquals(3, count(calls, to("M:" + TARGET + "#.ctor()", null)));
        one(calls, to("M:" + TARGET + "#.ctor(int)", null), "new InvocationTarget(1)");
        assertEquals(2, count(calls, to("M:" + TARGET + "+InvocationDerived#.ctor()", null)));
        one(calls, to("M:" + TARGET + "+InvocationDerived#.ctor(java.lang.String)", null), "new InvocationDerived(\"x\")");
        one(calls, to("M:" + TARGET + "+InvocationDerived#overridable()"), "overridable on the derived creation");
        one(calls, to("M:" + SYNTAX + "invocations.InvocationTargets#.ctor()", null), "cast creation");
        one(calls, to("M:" + TARGET + "#toString()"), "overridden toString on a creation");
        one(calls, to("M:java.lang.Object#getClass()"), "getClass()");
        one(calls, to("M:" + SYNTAX + "types.RecordKinds+PlainRecord#.ctor(int,java.lang.String)", null), "record creation");
        one(calls, to("M:java.util.List`1#get(int)"), "list element");
        one(calls, to("M:java.util.Map`2#get(java.lang.Object)"), "map element");
        assertEquals(3, count(calls, to("M:" + BASE_TYPE + "#overridable()")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void overloadsResolveByTypeAndArity(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "argumentForms()");
        one(calls, to("M:" + FORMS + "#methodWithOverloads(int)"), "overload by type (int)");
        one(calls, to("M:" + FORMS + "#methodWithOverloads(java.lang.String)"), "overload by type (String)");
        one(calls, to("M:" + FORMS + "#methodWithOverloads(int,int)"), "overload by arity");
        one(calls, to("M:" + TARGET + "#instanceMethodWithArguments(int)"), "single-argument overload");
        assertEquals(9, count(calls, to(WITH_ARGUMENTS)));
        assertEquals(3, count(calls, to(GENERIC_INSTANCE)));
        String declarations = "M:" + SYNTAX + "members.MethodDeclarations#add";
        for (String parameters : List.of("(int)", "(int,int)", "(java.lang.String[])", "(java.util.List`1[java.lang.Integer])")) {
            one(calls, to(declarations + parameters), "MethodDeclarations#add" + parameters);
        }
        one(calls, to("M:java.lang.Math#addExact(int,int)", TYPE), "Math.addExact");
        assertEquals(5, count(calls, to(INSTANCE)));
        assertEquals(2, count(calls, edge -> edge.to().value().equals(INSTANCE) && edge.site().viaClosure()));
        one(calls, to("M:" + FORMS + "+2#.ctor()", null), "anonymous class inside the lambda");
        assertTrue(calls.stream().noneMatch(edge -> edge.to().value().equals("M:java.lang.Integer#intValue()") && engine != EngineKind.BYTECODE));
    }

    @Test
    void instanceGenericTypeArgumentsAreInferredFromArguments() {
        List<Edge.Invokes> calls = invokes(EngineKind.SOURCE, "argumentForms()");
        assertEquals(2, count(calls, edge -> edge.to().value().equals(GENERIC_INSTANCE) && typeArguments(edge).equals(List.of("java.lang.Integer")) && edge.receiver() == LOCAL));
        one(calls, edge -> edge.to().value().equals(GENERIC_INSTANCE) && typeArguments(edge).equals(List.of(TARGET)), "type argument inferred from an argument expression");
        one(calls, edge -> edge.to().value().equals("M:java.util.Arrays#stream`1(!!0[])") && typeArguments(edge).equals(List.of(TARGET)), "Arrays.stream");
        one(calls, edge -> edge.to().value().equals("M:java.util.List`1#of`1(!!0)") && typeArguments(edge).equals(List.of("java.lang.Integer")), "List.of(1)");
        assertEquals(3, count(calls, to(WITH_ARGUMENTS, LOCAL).and(edge -> edge.site().location().startLine() >= 274 && edge.site().location().startLine() <= 276)));
        one(calls, edge -> edge.to().value().equals(MAP) && typeArguments(edge).equals(List.of(FORMS + "+2")), "map to the anonymous class");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void streamPipelinesAreChainsOfCallsAndClosureCalls(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "streamPipelines()");
        assertEquals(2, count(calls, to("M:java.util.Collection`1#stream()")));
        assertEquals(2, count(calls, to("M:java.util.stream.Stream`1#filter(java.util.function.Predicate`1[<other:? super !0>])")));
        one(calls, to(MAP), "map");
        one(calls, to(COLLECT), "collect");
        one(calls, to("M:java.util.stream.Stream`1#mapToInt(java.util.function.ToIntFunction`1[<other:? super !0>])"), "mapToInt");
        one(calls, to("M:java.util.stream.IntStream#sum()"), "sum");
        one(calls, to("M:java.util.stream.Stream`1#count()"), "count");
        one(calls, to("M:java.util.stream.Stream`1#of`1(!!0[])", TYPE), "Stream.of");
        one(calls, to("M:java.util.stream.Collectors#toList`1()", TYPE), "Collectors.toList");
        assertEquals(2, count(calls, to(INSTANCE)));
        assertTrue(calls.stream().filter(to(INSTANCE)).allMatch(edge -> edge.site().viaClosure()), "a method reference is no call");
    }

    @Test
    void lambdaParametersAreParameterReceiversAndGenericsAreInferred() {
        List<Edge.Invokes> calls = invokes(EngineKind.SOURCE, "streamPipelines()");
        assertEquals(2, count(calls, to(INSTANCE, PARAMETER).and(edge -> edge.site().viaClosure())));
        one(calls, edge -> edge.to().value().equals(MAP) && typeArguments(edge).equals(List.of("java.lang.Integer")) && edge.receiver() == RETURN_VALUE, "map<Integer>");
        one(calls, edge -> edge.to().value().equals("M:java.util.stream.Stream`1#of`1(!!0[])") && typeArguments(edge).equals(List.of(TARGET)), "Stream.of<InvocationTarget>");
        Edge.Invokes collect = one(calls, to(COLLECT, RETURN_VALUE), "collect");
        assertEquals("java.util.List`1[java.lang.Integer]", collect.typeArguments().get(0).canonical());
        assertEquals("?", ((TypeRef.Other) collect.typeArguments().get(1)).text(), "a captured wildcard is written as the wildcard it captures");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void methodReferencesProduceNoCall(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "methodReference()");
        assertEquals(2, count(calls, to("M:java.lang.Runnable#run()")));
        one(calls, to("M:java.util.function.Supplier`1#get()"), "constructor.get()");
        assertTrue(calls.stream().noneMatch(edge -> edge.to().value().startsWith("M:" + SYNTAX)), calls.toString());
        assertTrue(Models.invokes(Models.syntax(engine), "F:" + FORMS + ".supplierField").isEmpty());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void functionalInterfaceCallsTargetTheirSingleAbstractMethod(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "functionalInterfaceInvocations()");
        assertEquals(5, count(calls, to("M:java.util.function.Supplier`1#get()")));
        assertEquals(4, count(calls, to("M:java.util.function.Function`2#apply(!0)")));
        one(calls, to("M:java.util.function.Function`2#andThen`1(java.util.function.Function`2[<other:? super !1>,<other:? extends !!0>])"), "andThen");
        one(calls, to("M:" + TARGET + "#returnsSupplier()"), "returnsSupplier");
        one(calls, to("M:" + TARGET + "#returnsCurried()"), "returnsCurried");
        assertTrue(calls.stream().noneMatch(to(INSTANCE)), "local::instanceMethod is no call");
        if (engine != EngineKind.BYTECODE) {
            one(calls, to("M:java.util.function.Supplier`1#get()", OTHER), "immediately invoked cast lambda");
            assertEquals(2, count(calls, to("M:java.util.function.Function`2#apply(!0)", RETURN_VALUE)));
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void otherExpressionContextsAttributeToTheMethod(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "otherExpressionContexts()");
        one(calls, edge -> edge.to().value().equals("M:" + FORMS + "#instanceMethodOnThisClass()") && edge.site().viaClosure(), "this call inside a lambda");
        assertEquals(2, count(calls, to(INSTANCE)));
        assertEquals(2, count(calls, to(STATIC, TYPE)));
        one(calls, to("M:java.util.function.Supplier`1#get()"), "viaThisInLambda.get()");
        one(Models.accesses(Models.syntax(engine), "M:" + FORMS + "#otherExpressionContexts()"), access("F:" + FORMS + ".counter", AccessKind.READ), "counter in the ternary");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void reflectionIsOrdinaryCallsOnClassAndMethod(EngineKind engine) {
        List<Edge.Invokes> calls = invokes(engine, "reflectionInvocations()");
        assertEquals(2, count(calls, to(GET_METHOD)));
        assertEquals(2, count(calls, to(INVOKE)));
        one(calls, to("M:java.lang.Class`1#getDeclaredConstructor(java.lang.Class`1[<other:?>][])"), "getDeclaredConstructor");
        one(calls, to("M:java.lang.reflect.Constructor`1#newInstance(java.lang.Object[])"), "newInstance");
        one(calls, to(INSTANCE), "instanceMethod on the reflective instance");
        if (engine != EngineKind.BYTECODE) {
            assertEquals(2, count(calls, to(GET_METHOD, LITERAL)));
            one(calls, to(INVOKE, LOCAL), "methodInfo.invoke(null)");
            one(calls, to(INVOKE, RETURN_VALUE), "getMethod(...).invoke(local)");
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void localClassesAreNodesWhoseMethodsAreCalled(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        var local = Models.type(model, LOCAL_FUNCTIONS);
        assertEquals(true, local.languageSpecific().get("java.isLocal"));
        assertEquals("M:" + FORMS + "#localClassInvocations()", local.languageSpecific().get("java.enclosingMethod"));
        List<Edge.Invokes> calls = invokes(engine, "localClassInvocations()");
        one(calls, to("M:" + LOCAL_FUNCTIONS + "#.ctor()", null), "new LocalFunctions()");
        one(calls, to("M:" + LOCAL_FUNCTIONS + "#localFunction()"), "localFunction()");
        one(calls, to("M:" + LOCAL_FUNCTIONS + "#localFunctionWithParameter(int)"), "localFunctionWithParameter(1)");
        assertEquals(2, count(calls, to("M:" + LOCAL_FUNCTIONS + "#genericLocalFunction`1(!!0)")));
        one(calls, to("M:" + LOCAL_FUNCTIONS + "#recursiveLocalFunction(int)"), "recursiveLocalFunction(2)");
        one(calls, to("M:" + LOCAL_FUNCTIONS + "#callingStaticFromLocalClass()"), "callingStaticFromLocalClass()");
        one(calls, to("M:" + FORMS + "#localFunctionDeclaredLater()"), "method named like a local function");
        one(calls, to("M:java.util.function.Supplier`1#get()"), "functions::localFunction is no call");
        Models.method(model, LOCAL_FUNCTIONS + "#genericLocalFunction`1(!!0)");
        one(Models.invokes(model, "M:" + LOCAL_FUNCTIONS + "#recursiveLocalFunction(int)"), to("M:" + LOCAL_FUNCTIONS + "#recursiveLocalFunction(int)"), "recursion");
        one(Models.invokes(model, "M:" + LOCAL_FUNCTIONS + "#callingStaticFromLocalClass()"), to(STATIC, TYPE), "static call from the local class");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void callsCompiledAgainstAVisibilityBridgeBindTheInheritedMethod(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String bridges = SYNTAX + "invocations.VisibilityBridges";
        one(Models.invokes(model, "M:" + bridges + "#ownModule(" + bridges + "+Exposed)"), to("M:" + bridges + "+HiddenBase#inherited()"), "exposed.inherited()");
        List<Edge.Invokes> platform = Models.invokes(model, "M:" + bridges + "#platform(java.lang.StringBuilder)");
        one(platform, to("M:java.lang.AbstractStringBuilder#setLength(int)"), "builder.setLength(0)");
        one(platform, to("M:java.lang.AbstractStringBuilder#length()"), "builder.length()");
    }
}
