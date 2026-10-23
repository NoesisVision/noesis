package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.scanner.core.Models.OTHER;
import static vision.noesis.scanner.core.Models.SYNTAX;
import static vision.noesis.scanner.core.Models.access;
import static vision.noesis.scanner.core.Models.count;
import static vision.noesis.scanner.core.Models.one;
import static vision.noesis.scanner.core.Models.to;
import static vision.noesis.scanner.model.ExpressionKind.BASE;
import static vision.noesis.scanner.model.ExpressionKind.THIS;
import static vision.noesis.scanner.model.ExpressionKind.TYPE;

import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.scanner.model.AccessKind;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.AnnotationArgument;
import vision.noesis.scanner.model.AnnotationValue;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.Modifier;
import vision.noesis.scanner.model.StubKind;
import vision.noesis.scanner.model.StubNode;
import vision.noesis.scanner.model.TypeKind;
import vision.noesis.scanner.model.TypeNode;

/** The {@code java-syntax-other} model, and how the syntax model reaches its members across the module boundary. */
class OtherModuleFactsTest {

    private static final String USAGE = SYNTAX + "typeusage.OtherModuleTypeUsage";
    private static final String USAGE_CTOR = "M:" + USAGE + "#.ctor(" + OTHER + "OtherUsedType," + OTHER + "OtherEnum)";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constantsCarryTheirValues(EngineKind engine) {
        CodeModelFile model = Models.other(engine);
        TypeNode constants = Models.type(model, OTHER + "OtherConstants");
        assertEquals(List.of(Modifier.FINAL), constants.modifiers());
        FieldNode constant = Models.field(model, OTHER + "OtherConstants.CONSTANT");
        assertEquals("42", constant.constantValue());
        assertEquals("int", constant.type().canonical());
        assertEquals(List.of(Modifier.STATIC, Modifier.READONLY), constant.modifiers());
        FieldNode text = Models.field(model, OTHER + "OtherConstants.TEXT");
        assertEquals("\"other\"", text.constantValue());
        assertEquals("java.lang.String", text.type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theExceptionExtendsThePlatformAndStubsIt(EngineKind engine) {
        CodeModelFile model = Models.other(engine);
        assertEquals(List.of("java.lang.Exception"), Models.extendsOf(model, "T:" + OTHER + "OtherException"));
        StubNode exception = Models.stub(model, "T:java.lang.Exception");
        assertEquals(StubKind.TYPE, exception.kind());
        assertEquals("Exception", exception.name());
        assertEquals(TypeKind.CLASS, exception.typeKind());
        assertEquals("A:java.base@17", exception.artifact().value());
        assertTrue(model.stubs().stream().noneMatch(stub -> stub.id().value().startsWith("T:" + OTHER)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void abstractGenericNestedAndFunctionalTypesKeepTheirShape(EngineKind engine) {
        CodeModelFile model = Models.other(engine);
        MethodNode abstractMethod = Models.method(model, OTHER + "OtherAbstractClass#abstractMethodFromOtherModule()");
        assertEquals(List.of(Modifier.ABSTRACT), abstractMethod.modifiers());
        assertTrue(abstractMethod.bodiless());
        assertFalse(Models.method(model, OTHER + "OtherAbstractClass#concreteMethodFromOtherModule()").bodiless());
        TypeNode generic = Models.type(model, OTHER + "OtherGeneric`1");
        assertEquals(TypeKind.CLASS, generic.typeKind());
        assertEquals(1, generic.typeParameters().size());
        assertEquals("!0", Models.method(model, OTHER + "OtherGeneric`1#item()").signature().returnType().canonical());
        assertEquals(List.of(Modifier.STATIC), Models.type(model, OTHER + "OtherClass+Nested").modifiers());
        assertTrue(Models.contains(model, "T:" + OTHER + "OtherClass", "T:" + OTHER + "OtherClass+Nested"));
        TypeNode function = Models.type(model, OTHER + "OtherFunction");
        assertEquals(TypeKind.INTERFACE, function.typeKind());
        assertEquals("java.lang.FunctionalInterface", one(function.annotations(), annotation -> true, "FunctionalInterface").type().canonical());
        assertTrue(Models.method(model, OTHER + "OtherFunction#apply(int)").bodiless());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void annotationMembersCarryTheirDefaultsInTheBag(EngineKind engine) {
        CodeModelFile model = Models.other(engine);
        TypeNode annotation = Models.type(model, OTHER + "OtherAnnotation");
        assertEquals(TypeKind.INTERFACE, annotation.typeKind());
        assertEquals(true, annotation.languageSpecific().get("java.isAnnotation"));
        assertEquals("\"\"", Models.method(model, OTHER + "OtherAnnotation#value()").languageSpecific().get("java.defaultValue"));
        assertEquals("java.lang.Object", Models.method(model, OTHER + "OtherAnnotation#type()").languageSpecific().get("java.defaultValue"));
        assertEquals(OTHER + "OtherEnum.ALPHA", Models.method(model, OTHER + "OtherAnnotation#kind()").languageSpecific().get("java.defaultValue"));
        assertEquals("java.lang.Class`1[<other:?>]", Models.method(model, OTHER + "OtherAnnotation#type()").signature().returnType().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theSyntaxModelInheritsOverridesAndChainsIntoTheOtherModule(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(OTHER + "OtherAbstractClass"), Models.extendsOf(model, "T:" + USAGE));
        assertEquals(List.of("java.util.Comparator`1[" + OTHER + "OtherRecord]", OTHER + "OtherInterface`1[" + OTHER + "OtherUsedType]", OTHER + "OtherPlainInterface"),
                Models.implementsOf(model, "T:" + USAGE).stream().sorted().toList());
        assertEquals(List.of("M:" + OTHER + "OtherAbstractClass#abstractMethodFromOtherModule()"), Models.overridesOf(model, "M:" + USAGE + "#abstractMethodFromOtherModule()"));
        Edge.ImplementsMember put = one(Models.implementsMembersOf(model, "M:" + USAGE + "#put(" + OTHER + "OtherUsedType)"), edge -> true, "put slot");
        assertEquals("M:" + OTHER + "OtherInterface`1#put(!0)", put.to().value());
        assertEquals(OTHER + "OtherInterface`1[" + OTHER + "OtherUsedType]", put.interfaceType().canonical());
        List<Edge.Invokes> noArguments = Models.invokes(model, "M:" + USAGE + "#.ctor()");
        one(noArguments, to(USAGE_CTOR, THIS), "this(...)");
        one(noArguments, to("M:" + OTHER + "OtherUsedType#.ctor()", null), "argument of this(...)");
        one(Models.accesses(model, "M:" + USAGE + "#.ctor()"), access("F:" + OTHER + "OtherEnum.ALPHA", AccessKind.READ).and(edge -> edge.receiver() == TYPE), "enum argument");
        one(Models.invokes(model, USAGE_CTOR), to("M:" + OTHER + "OtherAbstractClass#.ctor()", BASE), "implicit super() into the other module");
        assertTrue(model.stubs().stream().noneMatch(stub -> stub.id().value().contains("vision.noesis.fixture.other")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void bodiesCallAndReadOtherModuleMembers(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String body = "M:" + USAGE + "#bodyLevelUse(java.lang.Object)";
        List<Edge.Invokes> calls = Models.invokes(model, body);
        assertEquals(2, count(calls, to("M:" + OTHER + "OtherRecord#count()")));
        one(calls, to("M:" + OTHER + "OtherClass#.ctor(int)", null), "new OtherClass(1)");
        one(calls, to("M:" + OTHER + "OtherConstants#staticMethodFromOtherModule()", TYPE), "static call");
        one(calls, to("M:" + OTHER + "OtherException#.ctor(java.lang.String)", null), "new OtherException(...)");
        one(calls, to("M:" + OTHER + "OtherClass+Nested#nestedValue()"), "nested type method");
        one(calls, to("M:" + OTHER + "OtherCloseable#.ctor()", null), "try-with-resources resource");
        one(calls, to("M:" + OTHER + "OtherUsedType#.ctor()", null), "new OtherUsedType()");
        one(calls, to("M:" + OTHER + "OtherUsedType#.ctor(double)", null), "new OtherUsedType(1.0)");
        one(calls, to("M:" + USAGE + "+1LocalFunction#apply(" + OTHER + "OtherUsedType," + OTHER + "OtherEnum)"), "local class with other-module parameters");
        List<Edge.Accesses> accesses = Models.accesses(model, body);
        one(accesses, access("F:" + OTHER + "OtherClass.value", AccessKind.READ), "field read");
        one(accesses, access("F:" + OTHER + "OtherEnum.BETA", AccessKind.READ).and(edge -> edge.receiver() == TYPE), "enum constant");
        one(accesses, access("F:" + OTHER + "OtherEnum.ALPHA", AccessKind.READ).and(edge -> edge.site().viaClosure()), "enum constant inside the typed lambda");
        assertTrue(accesses.stream().noneMatch(edge -> edge.to().value().contains("OtherConstants")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void otherModuleAnnotationArgumentsAreTypedValues(EngineKind engine) {
        TypeNode usage = Models.type(Models.syntax(engine), USAGE);
        Annotation annotation = one(usage.annotations(), a -> a.type().canonical().equals(OTHER + "OtherAnnotation"), "@OtherAnnotation");
        assertEquals(List.of("value", "type", "kind"), annotation.arguments().stream().map(AnnotationArgument::name).toList());
        assertEquals("\"other module\"", ((AnnotationValue.Literal) annotation.arguments().get(0).value()).text());
        assertEquals(OTHER + "OtherUsedType", ((AnnotationValue.TypeValue) annotation.arguments().get(1).value()).type().canonical());
        AnnotationValue.EnumValue kind = (AnnotationValue.EnumValue) annotation.arguments().get(2).value();
        assertEquals(OTHER + "OtherEnum", kind.type().canonical());
        assertEquals("BETA", kind.member());
        assertFalse(annotation.arguments().get(1).positional());
        assertFalse(annotation.arguments().get(2).positional());
    }
}
