package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.parser.core.Models.OTHER;
import static vision.noesis.parser.core.Models.SYNTAX;
import static vision.noesis.parser.core.Models.access;
import static vision.noesis.parser.core.Models.count;
import static vision.noesis.parser.core.Models.one;
import static vision.noesis.parser.core.Models.to;
import static vision.noesis.parser.core.Models.typeArguments;
import static vision.noesis.parser.model.AccessKind.READ;
import static vision.noesis.parser.model.ExpressionKind.CREATION;
import static vision.noesis.parser.model.ExpressionKind.LOCAL;
import static vision.noesis.parser.model.ExpressionKind.RETURN_VALUE;
import static vision.noesis.parser.model.ExpressionKind.TYPE;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.TypeNode;

/**
 * Lambdas, local and anonymous classes in {@code LocalFunctionsAndLambdas}, {@code LocalVariableForms} and {@code InvocationForms}, and the import
 * forms of {@code ImportForms}, {@code ImportsFromParentPackage} and {@code ClassInDeeplyNestedPackage}.
 */
class LambdaAndImportFactsTest {

    private static final String LAMBDAS = SYNTAX + "members.LocalFunctionsAndLambdas";
    private static final String WITH_LAMBDAS = "M:" + LAMBDAS + "#methodWithLambdas()";
    private static final String WITH_LOCALS = "M:" + LAMBDAS + "#methodWithLocalFunctions(int)";
    private static final String APPLY = "M:java.util.function.Function`2#apply(!0)";
    private static final String IMPORTS = SYNTAX + "imports.ImportForms";
    private static final String USE_IMPORTS = "M:" + IMPORTS + "#useImportedTypes()";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void lambdasAreNotNodesButLocalClassesAre(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertTrue(model.nodes().stream().noneMatch(node -> node.id().value().contains("lambda$")));
        for (String local : List.of("BlockBodiedLocalFunction", "ExpressionBodiedLocalFunction", "StaticLocalFunction", "LocalEnumFunction", "LocalInterfaceFunction",
                "GenericLocalFunction", "AsyncLocalFunction", "IteratorLocalFunction", "LocalFunctionWithOptionalAndParams", "LocalFunctionWithAttribute", "NestedLocalFunctionOuter")) {
            TypeNode node = Models.type(model, LAMBDAS + "+1" + local);
            assertEquals(local, node.name());
            assertEquals(true, node.languageSpecific().get("java.isLocal"));
            assertEquals(WITH_LOCALS, node.languageSpecific().get("java.enclosingMethod"));
        }
        TypeNode inner = Models.type(model, LAMBDAS + "+1NestedLocalFunctionOuter+1NestedLocalFunctionInner");
        assertEquals(true, inner.languageSpecific().get("java.isLocal"));
        assertEquals("M:" + LAMBDAS + "+1NestedLocalFunctionOuter#invoke()", inner.languageSpecific().get("java.enclosingMethod"));
        Models.method(model, LAMBDAS + "+1BlockBodiedLocalFunction#.ctor()");
        Models.method(model, SYNTAX + "localvariables.LocalVariableForms+1LocalClassCapturingLocal#.ctor()");
        Models.method(model, SYNTAX + "invocations.InvocationForms+2#.ctor()");
        one(Models.invokes(model, WITH_LOCALS), to("M:" + LAMBDAS + "+1BlockBodiedLocalFunction#.ctor()", null), "new BlockBodiedLocalFunction()");
        List<Edge.Invokes> allLocals = Models.invokes(model, "M:" + SYNTAX + "localvariables.LocalVariableForms#allLocalVariableForms()");
        one(allLocals, to("M:" + SYNTAX + "localvariables.LocalVariableForms+1LocalClassCapturingLocal#.ctor()", null), "new LocalClassCapturingLocal()");
        // bytecode receivers are OTHER (design §4)
        one(allLocals, to("M:" + SYNTAX + "localvariables.LocalVariableForms+1LocalClassCapturingLocal#read()", engine == EngineKind.BYTECODE ? ExpressionKind.OTHER : CREATION), "call on the local class creation");
        one(Models.invokes(model, "M:" + LAMBDAS + "+1NestedLocalFunctionOuter#invoke()"), to("M:" + LAMBDAS + "+1NestedLocalFunctionOuter+1NestedLocalFunctionInner#invoke()"), "nested local class call");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void localFunctionCallsTargetTheLocalClassMembers(EngineKind engine) {
        List<Edge.Invokes> calls = Models.invokes(Models.syntax(engine), WITH_LOCALS);
        one(calls, to("M:" + LAMBDAS + "+1BlockBodiedLocalFunction#invoke(int)"), "block-bodied local");
        one(calls, to("M:" + LAMBDAS + "+1StaticLocalFunction#invoke(int)", TYPE), "static method of a local record");
        one(calls, to("M:" + LAMBDAS + "+1LocalInterfaceFunction#invoke(int)", TYPE), "static method of a local interface");
        one(calls, to("M:" + LAMBDAS + "+1LocalEnumFunction#invoke(int)"), "method on a local enum constant");
        one(calls, to("M:" + LAMBDAS + "+1GenericLocalFunction#invoke`1(!!0)"), "generic local");
        assertEquals(2, count(calls, to("M:" + LAMBDAS + "+1LocalFunctionWithOptionalAndParams#invoke(int,int[])")));
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#join()"), "join on the async local");
        one(Models.accesses(Models.syntax(engine), WITH_LOCALS), access("F:" + LAMBDAS + "+1LocalEnumFunction.INSTANCE", READ).and(edge -> edge.receiver() == TYPE), "enum constant of the local enum");
        one(Models.accesses(Models.syntax(engine), "M:" + LAMBDAS + "+1ExpressionBodiedLocalFunction#invoke(int)"), access("F:" + LAMBDAS + ".field", READ).and(edge -> !edge.site().viaClosure()), "field read from the local class body");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void lambdaBodiesAttributeToTheMemberViaClosure(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Edge.Accesses> accesses = Models.accesses(model, WITH_LAMBDAS);
        assertEquals(1, accesses.size());
        one(accesses, access("F:" + LAMBDAS + ".field", READ).and(edge -> edge.site().viaClosure()), "field captured in a lambda");
        one(Models.accesses(model, "M:" + LAMBDAS + "#instanceTarget(int)"), access("F:" + LAMBDAS + ".field", READ).and(edge -> !edge.site().viaClosure()), "field read outside a closure");
        assertTrue(Models.method(model, LAMBDAS + "#methodWithLambdas()").annotations().isEmpty(), "an annotation on a lambda parameter is not the method's");
        List<Edge.Invokes> calls = Models.invokes(model, WITH_LAMBDAS);
        assertEquals(13, count(calls, to(APPLY)));
        one(calls, to(APPLY).and(edge -> edge.site().viaClosure()), "lambda invoking another lambda");
        assertEquals(6, count(calls, to("M:java.util.function.IntUnaryOperator#applyAsInt(int)")));
        one(calls, to("M:java.util.function.IntBinaryOperator#applyAsInt(int,int)"), "two-parameter lambda");
        one(calls, to("M:java.util.function.IntSupplier#getAsInt()"), "no-parameter lambda");
        one(calls, to("M:" + LAMBDAS + "+VarargsFunction#apply(int[])"), "varargs functional interface");
        one(calls, to("M:" + LAMBDAS + "+TwoIntAction#accept(int,int)"), "own functional interface");
        assertEquals(3, count(calls, to("M:java.lang.Runnable#run()")));
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#supplyAsync`1(java.util.function.Supplier`1[!!0])", TYPE).and(edge -> edge.site().viaClosure()), "async lambda");
        one(calls, to("M:java.util.concurrent.CompletableFuture`1#runAsync(java.lang.Runnable)", TYPE).and(edge -> edge.site().viaClosure()), "async expression lambda");
        assertTrue(calls.stream().noneMatch(edge -> edge.to().value().contains("staticTarget") || edge.to().value().contains("instanceTarget")), "method references are no calls");
        one(calls, to("M:" + LAMBDAS + "+1#.ctor()", null), "anonymous Runnable");
        one(calls, to("M:" + LAMBDAS + "+2#.ctor()", null), "anonymous IntUnaryOperator");
    }

    @Test
    void curriedLambdasChainOnTheReturnValue() {
        List<Edge.Invokes> calls = Models.invokes(Models.syntax(EngineKind.SOURCE), WITH_LAMBDAS);
        one(calls, to(APPLY, RETURN_VALUE), "curriedLambda.apply(1).apply(2)");
        assertEquals(12, count(calls, to(APPLY, LOCAL)));
        assertEquals(List.of("java.lang.Integer"), typeArguments(one(calls, to("M:java.util.concurrent.CompletableFuture`1#supplyAsync`1(java.util.function.Supplier`1[!!0])"), "supplyAsync")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void anonymousClassesImplementTheirInterface(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode anonymous = Models.type(model, LAMBDAS + "+2");
        assertEquals("2", anonymous.name());
        assertEquals(true, anonymous.languageSpecific().get("java.isAnonymous"));
        assertEquals(WITH_LAMBDAS, anonymous.languageSpecific().get("java.enclosingMethod"));
        assertEquals(List.of("java.util.function.IntUnaryOperator"), Models.implementsOf(model, "T:" + LAMBDAS + "+2"));
        Edge.ImplementsMember slot = one(Models.implementsMembersOf(model, "M:" + LAMBDAS + "+2#applyAsInt(int)"), edge -> true, "applyAsInt slot");
        assertEquals("M:java.util.function.IntUnaryOperator#applyAsInt(int)", slot.to().value());
        assertEquals(List.of("java.lang.Runnable"), Models.implementsOf(model, "T:" + LAMBDAS + "+1"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void everyImportFormResolvesToTheRightId(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Edge.Invokes> calls = Models.invokes(model, USE_IMPORTS);
        one(calls, to("M:java.io.StringReader#.ctor(java.lang.String)", null), "on-demand import");
        one(calls, to("M:java.lang.Math#abs(double)", TYPE), "static on-demand import");
        one(calls, to("M:java.util.stream.IntStream#range(int,int)", TYPE), "static single import");
        one(calls, to("M:java.util.stream.Collectors#toList`1()", TYPE), "static import of a collector");
        one(calls, to("M:" + SYNTAX + "types.ClassKinds+OuterClassWithNestedTypes+NestedRecord#.ctor(int)", null), "nested type import");
        one(calls, to("M:java.util.ArrayList`1#.ctor()", null), "ArrayList via the on-demand java.util.* import");
        one(calls, to("M:" + SYNTAX + "imports.Types#.ctor()", null), "same package");
        one(calls, to("M:" + SYNTAX + "members.MethodDeclarations#.ctor()", null), "own module import");
        one(calls, to("M:java.util.concurrent.ConcurrentHashMap`2#.ctor()", null), "fully qualified generic");
        one(calls, to("M:" + SYNTAX + "types.ClassKinds+PlainClass#.ctor()", null), "fully qualified own type");
        one(calls, to("M:" + OTHER + "OtherClass#.ctor()", null), "other module import");
        one(calls, to("M:" + OTHER + "nested.NestedNamespaceInOtherModule#.ctor()", null), "other module nested package");
        one(calls, to("M:" + OTHER + "OtherClass+Nested#.ctor()", null), "other module nested type");
        one(calls, to("M:java.io.Reader#close()"), "close on the on-demand-imported type");
        List<Edge.Accesses> accesses = Models.accesses(model, USE_IMPORTS);
        one(accesses, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST", READ).and(edge -> edge.site().location().startLine() == 28), "static-imported enum constant");
        one(accesses, access("F:" + SYNTAX + "types.ClassKinds+OuterClassWithNestedTypes+NestedEnum.ONE", READ).and(edge -> edge.receiver() == TYPE), "nested enum via static on-demand import");
        one(accesses, access("F:" + OTHER + "OtherEnum.ALPHA", READ).and(edge -> edge.receiver() == TYPE), "other module fully qualified enum");
        one(accesses, access("F:java.nio.charset.StandardCharsets.UTF_8", READ).and(edge -> edge.receiver() == TYPE), "fully qualified static field");
        assertTrue(accesses.stream().noneMatch(edge -> edge.to().value().contains("OtherConstants") || edge.to().value().contains("Math.PI")));
        // the raw Iterable and Collection locals (lines 36-37) produce no edge of any kind
        List<Edge.UsesType> uses = Models.usesTypes(model, USE_IMPORTS);
        for (int line : List.of(36, 37)) {
            assertTrue(calls.stream().noneMatch(edge -> edge.site().location().startLine() == line), "INVOKES on line " + line);
            assertTrue(accesses.stream().noneMatch(edge -> edge.site().location().startLine() == line), "ACCESSES on line " + line);
            assertTrue(uses.stream().noneMatch(edge -> edge.site().location().startLine() == line), "USES_TYPE on line " + line);
        }
    }

    @Test
    void importedCreationsCarryTypeArgumentsAndCaseLabelsReadConstants() {
        List<Edge.Invokes> calls = Models.invokes(Models.syntax(EngineKind.SOURCE), USE_IMPORTS);
        assertEquals(List.of("java.lang.String"), typeArguments(one(calls, to("M:java.util.ArrayList`1#.ctor()"), "ArrayList<>")));
        assertEquals(List.of("java.lang.Integer", "java.lang.Integer"), typeArguments(one(calls, to("M:java.util.concurrent.ConcurrentHashMap`2#.ctor()"), "ConcurrentHashMap<>")));
        one(calls, to("M:java.io.Reader#close()", LOCAL), "viaOnDemandImport.close()");
        List<Edge.Accesses> accesses = Models.accesses(Models.syntax(EngineKind.SOURCE), USE_IMPORTS);
        assertEquals(2, count(accesses, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST", READ)));
        one(accesses, access("F:" + SYNTAX + "types.EnumKinds+PlainEnum.SECOND", READ), "case SECOND");
        assertEquals(1, count(Models.accesses(Models.syntax(EngineKind.BYTECODE), USE_IMPORTS), edge -> edge.to().value().endsWith("PlainEnum.FIRST")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constantExpressionsFoldAcrossModules(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        FieldNode constant = Models.field(model, IMPORTS + ".VIA_OTHER_MODULE_CONSTANT_EXPRESSION");
        assertEquals("84", constant.constantValue());
        assertEquals("int", constant.type().canonical());
        assertTrue(Models.invokes(model, constant.id().value()).isEmpty());
        assertTrue(Models.accesses(model, constant.id().value()).isEmpty());
        // the field checks are vacuous in bytecode, which has no field initializers: there, no .cctor and no read of CONSTANT in ImportForms
        assertFalse(Models.has(model, "M:" + IMPORTS + "#.cctor()"));
        assertTrue(Models.edges(model, Edge.Accesses.class).filter(edge -> edge.from().value().contains(IMPORTS))
                .noneMatch(edge -> edge.to().value().equals("F:" + OTHER + "OtherConstants.CONSTANT")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void libraryAnnotationsAreStubbedWithTheirArtifact(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode method = Models.method(model, IMPORTS + "#methodWithLibraryAnnotation()");
        assertEquals(1, method.annotations().size());
        assertEquals("com.google.common.annotations.VisibleForTesting", method.annotations().get(0).type().canonical());
        assertTrue(method.annotations().get(0).arguments().isEmpty());
        assertEquals("A:com.google.guava:guava@" + System.getProperty("noesis.version.guava"), Models.stub(model, "T:com.google.common.annotations.VisibleForTesting").artifact().value());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void subpackagesImportTheirParentAndDeepPackagesResolveConflictingNames(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String parent = SYNTAX + "imports.nested.ImportsFromParentPackage";
        assertEquals(IMPORTS, Models.field(model, parent + ".viaParentPackageImport").type().canonical());
        assertEquals(SYNTAX + "imports.Types", Models.field(model, parent + ".viaParentPackageQualifiedName").type().canonical());
        String deep = SYNTAX + "imports.dotted.deeply.nested.ClassInDeeplyNestedPackage";
        assertEquals(SYNTAX + "types.ClassKinds+PlainClass", Models.field(model, deep + ".viaPackageNamedLikeType").type().canonical());
        assertEquals(SYNTAX + "imports.Types", Models.field(model, deep + ".viaConflictingTypeName").type().canonical());
        // Iterable is java.lang, so the field named for the on-demand import resolves without it; Collection does need java.util.*
        assertEquals("java.lang.Iterable`1<>", Models.field(model, deep + ".nonGenericInterfaceViaOnDemandImport").type().canonical());
        assertEquals("java.util.Collection`1<>", Models.field(model, deep + ".nonGenericCollectionViaOnDemandImport").type().canonical());
        assertEquals("java.util.List`1[java.lang.Integer]", Models.field(model, deep + ".genericInterfaceViaSingleTypeImport").type().canonical());
        assertFalse(Models.hasStub(model, "T:" + IMPORTS));
    }

    @Test
    void initializersOfImportedTypesBelongToTheFieldInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        String parent = SYNTAX + "imports.nested.ImportsFromParentPackage";
        one(Models.invokes(model, "F:" + parent + ".viaParentPackageImport"), to("M:" + IMPORTS + "#.ctor()", null), "new ImportForms()");
        one(Models.invokes(model, "F:" + SYNTAX + "imports.dotted.deeply.nested.ClassInDeeplyNestedPackage.nonGenericInterfaceViaOnDemandImport"), to("M:java.util.ArrayList`1#.ctor()", null).and(edge -> edge.typeArguments().isEmpty()), "raw new ArrayList()");
        assertTrue(Models.invokes(model, "M:" + parent + "#.ctor()").stream().noneMatch(to("M:" + IMPORTS + "#.ctor()")));
    }
}
