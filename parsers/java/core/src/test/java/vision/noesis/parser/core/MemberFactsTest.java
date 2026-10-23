package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.parser.core.Models.SYNTAX;
import static vision.noesis.parser.core.Models.accesses;
import static vision.noesis.parser.core.Models.annotation;
import static vision.noesis.parser.core.Models.argument;
import static vision.noesis.parser.core.Models.field;
import static vision.noesis.parser.core.Models.invokes;
import static vision.noesis.parser.core.Models.literal;
import static vision.noesis.parser.core.Models.method;
import static vision.noesis.parser.core.Models.one;
import static vision.noesis.parser.core.Models.overridesOf;
import static vision.noesis.parser.core.Models.parameter;
import static vision.noesis.parser.core.Models.parameterTypes;
import static vision.noesis.parser.core.Models.usesTypes;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationValue;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.FieldKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodKind;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.TypeUseRole;
import vision.noesis.parser.model.Visibility;

/** Facts about fields and methods, pinned against both engines wherever the class file holds them. */
class MemberFactsTest {

    private static final String FIELDS = SYNTAX + "members.FieldDeclarations";
    private static final String METHODS = SYNTAX + "members.MethodDeclarations";
    private static final String SHAPES = SYNTAX + "members.ReturnAndParameterTypes+";
    private static final String OWN_ANNOTATION = "T:" + SYNTAX + "annotations.OwnAnnotation";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void fieldVisibilityNamesTheScope(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(Visibility.PUBLIC, field(model, FIELDS + ".publicField").visibility());
        assertEquals(Visibility.PRIVATE, field(model, FIELDS + ".privateField").visibility());
        assertEquals(Visibility.PROTECTED_OR_NAMESPACE, field(model, FIELDS + ".protectedField").visibility());
        assertEquals(Visibility.NAMESPACE, field(model, FIELDS + ".packagePrivateField").visibility());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void fieldModifiersAreFactsAndTransientGoesToTheBag(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        FieldNode plain = field(model, FIELDS + ".publicField");
        assertEquals(FieldKind.FIELD, plain.fieldKind());
        assertEquals(List.of(), plain.modifiers());
        assertEquals(Origin.DECLARED, plain.origin());
        assertTrue(plain.locations().get(0).file().endsWith("fixture/syntax/members/FieldDeclarations.java"));
        assertEquals(List.of(Modifier.STATIC), field(model, FIELDS + ".staticField").modifiers());
        assertEquals(List.of(Modifier.READONLY), field(model, FIELDS + ".readonlyField").modifiers());
        assertEquals(List.of(Modifier.VOLATILE), field(model, FIELDS + ".volatileField").modifiers());
        assertEquals(List.of(Modifier.STATIC, Modifier.VOLATILE), field(model, FIELDS + ".staticVolatileField").modifiers());
        FieldNode transientField = field(model, FIELDS + ".transientField");
        assertEquals(List.of(), transientField.modifiers());
        assertEquals(true, transientField.languageSpecific().get("java.transient"));
        assertNull(plain.languageSpecific().get("java.transient"));
        FieldNode lines = field(model, FIELDS + ".lines");
        assertEquals(Visibility.PRIVATE, lines.visibility());
        assertEquals("java.util.List`1[java.lang.String]", lines.type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void everyDeclaratorAndArrayShapeIsAField(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        for (String name : List.of("firstDeclarator", "secondDeclarator", "thirdDeclarator")) {
            FieldNode declarator = field(model, FIELDS + "." + name);
            assertEquals(Visibility.PUBLIC, declarator.visibility());
            assertEquals("int", declarator.type().canonical());
        }
        assertEquals("int[]", field(model, FIELDS + ".array").type().canonical());
        assertTrue(field(model, FIELDS + ".matrix").type() instanceof TypeRef.Array outer && outer.element() instanceof TypeRef.Array);
        assertEquals("java.lang.String[]", field(model, FIELDS + ".names").type().canonical());
        assertEquals("java.lang.ThreadLocal`1[java.lang.Integer]", field(model, FIELDS + ".THREAD_STATIC_FIELD").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constantsCarryTheirValueAsSourceText(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Map<String, String> expected = Map.of("INT_CONSTANT", "1", "LONG_CONSTANT", "2L", "SHORT_CONSTANT", "3", "BYTE_CONSTANT", "4", "CHAR_CONSTANT", "'c'",
                "DOUBLE_CONSTANT", "1.5", "BOOLEAN_CONSTANT", "true", "STRING_CONSTANT", "\"text with \\\"quotes\\\" and \\n newline\"");
        expected.forEach((name, text) -> {
            FieldNode constant = field(model, FIELDS + "." + name);
            assertEquals(text, constant.constantValue(), name);
            assertEquals(List.of(Modifier.STATIC, Modifier.READONLY), constant.modifiers(), name);
        });
        FieldNode enumField = field(model, FIELDS + ".ENUM_FIELD");
        assertEquals(FieldKind.FIELD, enumField.fieldKind());
        assertEquals(SYNTAX + "types.EnumKinds+PlainEnum", enumField.type().canonical());
        assertNull(enumField.constantValue());
        assertNull(field(model, FIELDS + ".THREAD_STATIC_FIELD").constantValue());
        FieldNode interfaceConstant = field(model, FIELDS + "+FieldsInInterface.CONST_FIELD_IN_INTERFACE");
        assertEquals("1", interfaceConstant.constantValue());
        assertEquals(Visibility.PUBLIC, interfaceConstant.visibility());
        assertEquals(List.of(Modifier.STATIC, Modifier.READONLY), interfaceConstant.modifiers());
        FieldNode interfaceObject = field(model, FIELDS + "+FieldsInInterface.STATIC_FIELD_IN_INTERFACE");
        assertNull(interfaceObject.constantValue());
        assertEquals(List.of(Modifier.STATIC, Modifier.READONLY), interfaceObject.modifiers());
        assertEquals("1", field(model, FIELDS + "+FieldsInStaticClass.CONST_FIELD_IN_STATIC_CLASS").constantValue());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericFieldTypesReferenceTheOwnerTypeParameterByOrdinal(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = FIELDS + "+FieldsWithGenericTypes`1";
        FieldNode generic = field(model, owner + ".genericField");
        assertEquals("!0", generic.type().canonical());
        assertTrue(generic.type() instanceof TypeRef.TypeParameterRef ref && ref.owner().value().equals("T:" + owner) && ref.ordinal() == 0, generic.type().toString());
        assertEquals("java.util.List`1[!0]", field(model, owner + ".genericCollectionField").type().canonical());
        assertEquals("java.util.Map`2[java.lang.String,java.util.List`1[!0]]", field(model, owner + ".nestedGenericField").type().canonical());
        assertEquals("!0[]", field(model, owner + ".genericArrayField").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void methodKindsHaveTheirSpecialNames(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode constructor = method(model, METHODS + "#.ctor()");
        assertEquals(MethodKind.CONSTRUCTOR, constructor.methodKind());
        assertEquals(".ctor", constructor.name());
        assertEquals(Visibility.PUBLIC, constructor.visibility());
        assertTrue(constructor.signature().returnType() instanceof TypeRef.Void);
        assertEquals("start", parameter(method(model, METHODS + "#.ctor(int)"), "start").name());
        MethodNode initializer = method(model, METHODS + "#.cctor()");
        assertEquals(MethodKind.STATIC_INITIALIZER, initializer.methodKind());
        assertEquals(".cctor", initializer.name());
        assertEquals(Visibility.PRIVATE, initializer.visibility());
        assertEquals(List.of(Modifier.STATIC), initializer.modifiers());
        MethodNode plain = method(model, METHODS + "#publicMethod()");
        assertEquals(MethodKind.METHOD, plain.methodKind());
        assertFalse(plain.bodiless());
        assertNull(plain.extensionReceiver());
        assertEquals("void", plain.signature().returnType().canonical());
        assertEquals(List.of(Modifier.VIRTUAL), plain.modifiers());
    }

    @Test
    void theStaticInitializerIsOneNodeLocatedAtEveryStaticBlock() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        MethodNode initializer = method(model, METHODS + "#.cctor()");
        assertEquals(List.of(17, 21), initializer.locations().stream().map(l -> l.startLine()).toList());
        List<Edge.Accesses> writes = accesses(model, initializer.id().value());
        assertEquals(2, writes.size());
        assertEquals(1, Models.count(writes, w -> w.access() == AccessKind.WRITE));
        assertEquals(1, Models.count(writes, w -> w.access() == AccessKind.READ_WRITE));
        assertTrue(writes.stream().allMatch(w -> w.to().value().equals("F:" + METHODS + ".staticCounter") && w.receiver() == ExpressionKind.TYPE));
        assertEquals(1, method(Models.syntax(EngineKind.BYTECODE), METHODS + "#.cctor()").locations().size());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void methodVisibilityNamesTheScope(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(Visibility.PUBLIC, method(model, METHODS + "#publicMethod()").visibility());
        assertEquals(Visibility.PROTECTED_OR_NAMESPACE, method(model, METHODS + "#protectedMethod()").visibility());
        assertEquals(Visibility.NAMESPACE, method(model, METHODS + "#packagePrivateMethod()").visibility());
        MethodNode privateMethod = method(model, METHODS + "#privateMethod()");
        assertEquals(Visibility.PRIVATE, privateMethod.visibility());
        assertEquals(List.of(), privateMethod.modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void methodModifiersThrowsAndSynchronizedAreFacts(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(Modifier.STATIC), method(model, METHODS + "#staticMethod()").modifiers());
        assertEquals(List.of(Modifier.FINAL), method(model, METHODS + "#finalMethod()").modifiers());
        MethodNode nativeMethod = method(model, METHODS + "#nativeMethod()");
        assertEquals(List.of(Modifier.VIRTUAL, Modifier.EXTERNAL), nativeMethod.modifiers());
        assertTrue(nativeMethod.bodiless());
        assertEquals(true, method(model, METHODS + "#synchronizedMethod()").languageSpecific().get("java.synchronized"));
        assertNull(method(model, METHODS + "#publicMethod()").languageSpecific().get("java.synchronized"));
        assertEquals(List.of("java.io.IOException", METHODS + "+CustomException"), method(model, METHODS + "#throwsMethod()").languageSpecific().get("java.throws"));
        assertNull(method(model, METHODS + "#publicMethod()").languageSpecific().get("java.throws"));
    }

    @Test
    void strictfpIsASourceOnlyBagKey() {
        MethodNode strict = method(Models.syntax(EngineKind.SOURCE), METHODS + "#strictMethod()");
        assertEquals(true, strict.languageSpecific().get("java.strictfp"));
        annotation(strict.annotations(), "T:java.lang.SuppressWarnings");
        assertNull(method(Models.syntax(EngineKind.BYTECODE), METHODS + "#strictMethod()").languageSpecific().get("java.strictfp"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void abstractMethodsAreBodilessAndTheirOverridesAreVirtualOrFinal(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String base = SHAPES + "MethodModifiers#";
        String derived = SHAPES + "MethodModifiersDerived#";
        MethodNode abstractMethod = method(model, base + "abstractMethod()");
        assertEquals(List.of(Modifier.ABSTRACT), abstractMethod.modifiers());
        assertTrue(abstractMethod.bodiless());
        MethodNode protectedAbstract = method(model, base + "protectedAbstractMethod()");
        assertEquals(Visibility.PROTECTED_OR_NAMESPACE, protectedAbstract.visibility());
        assertTrue(protectedAbstract.bodiless());
        MethodNode generic = method(model, base + "abstractGenericMethod`1(!!0)");
        assertEquals("T", generic.typeParameters().get(0).name());
        assertTrue(generic.signature().returnType() instanceof TypeRef.TypeParameterRef ref && ref.owner().value().equals(generic.id().value()));
        assertEquals(List.of("!!0"), parameterTypes(generic));
        assertEquals(List.of(Modifier.VIRTUAL), method(model, base + "virtualMethodToSeal()").modifiers());
        assertEquals(List.of(Modifier.FINAL), method(model, derived + "virtualMethodToSeal()").modifiers());
        MethodNode implemented = method(model, derived + "abstractMethod()");
        assertEquals(List.of(Modifier.VIRTUAL), implemented.modifiers());
        assertFalse(implemented.bodiless());
        for (String name : List.of("abstractMethod()", "protectedAbstractMethod()", "abstractGenericMethod`1(!!0)", "virtualMethod()", "virtualExpressionBodiedMethod()", "virtualMethodToSeal()")) {
            assertEquals(List.of("M:" + base + name), overridesOf(model, "M:" + derived + name), name);
        }
        Edge.Invokes superCall = one(invokes(model, "M:" + derived + "virtualMethod()"), e -> true, "call from the override");
        assertEquals("M:" + base + "virtualMethod()", superCall.to().value());
    }

    @Test
    void aSuperCallHasTheBaseReceiverInSource() {
        Edge.Invokes superCall = one(invokes(Models.syntax(EngineKind.SOURCE), "M:" + SHAPES + "MethodModifiersDerived#virtualMethod()"), e -> true, "super call");
        assertEquals(ExpressionKind.BASE, superCall.receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void interfaceMethodsAreAbstractUnlessTheyHaveABody(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = SHAPES + "MethodsInInterface#";
        MethodNode abstractMethod = method(model, owner + "abstractMethodInInterface()");
        assertEquals(List.of(Modifier.ABSTRACT), abstractMethod.modifiers());
        assertTrue(abstractMethod.bodiless());
        assertEquals(Visibility.PUBLIC, abstractMethod.visibility());
        MethodNode defaultMethod = method(model, owner + "defaultMethodInInterface()");
        assertEquals(List.of(Modifier.VIRTUAL), defaultMethod.modifiers());
        assertFalse(defaultMethod.bodiless());
        assertEquals(List.of(Modifier.STATIC), method(model, owner + "staticMethodInInterface()").modifiers());
        MethodNode privateStatic = method(model, owner + "privateStaticMethodInInterface()");
        assertEquals(Visibility.PRIVATE, privateStatic.visibility());
        assertEquals(List.of(Modifier.STATIC), privateStatic.modifiers());
        MethodNode generic = method(model, owner + "genericMethodInInterface`1(!!0)");
        assertEquals(List.of(Modifier.ABSTRACT), generic.modifiers());
        assertEquals("!!0", generic.signature().returnType().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void returnTypesHaveOneCanonicalForm(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = SHAPES + "ReturnTypes#";
        Map<String, String> expected = Map.ofEntries(
                Map.entry("voidReturn", "void"), Map.entry("primitiveReturn", "int"), Map.entry("referenceReturn", "java.lang.String"),
                Map.entry("nullableValueReturn", "java.lang.Integer"), Map.entry("arrayReturn", "int[]"), Map.entry("jaggedArrayReturn", "int[][]"),
                Map.entry("genericReturn", "java.util.List`1[java.lang.Integer]"), Map.entry("nestedGenericReturn", "java.util.Map`2[java.lang.String,java.util.List`1[java.lang.Integer]]"),
                Map.entry("interfaceReturn", "java.lang.Iterable`1[java.lang.Integer]"), Map.entry("iteratorReturn", "java.util.Iterator`1[java.lang.Integer]"),
                Map.entry("nonGenericIteratorReturn", "java.lang.Iterable`1<>"), Map.entry("objectReturn", "java.lang.Object"),
                Map.entry("delegateReturn", "java.util.function.Function`2[java.lang.Integer,java.lang.Integer]"), Map.entry("actionReturn", "java.lang.Runnable"),
                Map.entry("selfTypeReturn", SHAPES + "ReturnTypes"), Map.entry("nestedTypeReturn", SHAPES + "ReturnTypes+NestedTypeForReturn"),
                Map.entry("taskReturn", "java.util.concurrent.CompletableFuture`1[java.lang.Void]"), Map.entry("genericTaskReturn", "java.util.concurrent.CompletableFuture`1[java.lang.Integer]"),
                Map.entry("typeReturn", "java.lang.Class`1[<other:?>]"), Map.entry("enumReturn", SHAPES + "PlainEnumForMethods"));
        expected.forEach((name, canonical) -> assertEquals(canonical, method(model, owner + name + "()").signature().returnType().canonical(), name));
        assertTrue(method(model, owner + "voidReturn()").signature().returnType() instanceof TypeRef.Void);
        assertTrue(method(model, owner + "nonGenericIteratorReturn()").signature().returnType() instanceof TypeRef.Named raw && raw.unbound());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void parametersCarryNameTypeAndVariadicButNoFinalModifier(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = SHAPES + "ParameterKinds#";
        assertTrue(method(model, owner + "noParameters()").signature().parameters().isEmpty());
        MethodNode multiple = method(model, owner + "multipleParameters(int,java.lang.String,boolean)");
        assertEquals(List.of("first", "second", "third"), multiple.signature().parameters().stream().map(p -> p.name()).toList());
        assertEquals(List.of("int", "java.lang.String", "boolean"), parameterTypes(multiple));
        assertTrue(multiple.signature().parameters().stream().noneMatch(p -> p.variadic()));
        assertTrue(parameter(method(model, owner + "paramsArrayParameter(int[])"), "values").variadic());
        MethodNode trailing = method(model, owner + "paramsAfterRegularParameters(java.lang.String,java.lang.Object[])");
        assertFalse(parameter(trailing, "first").variadic());
        assertTrue(parameter(trailing, "rest").variadic());
        assertEquals("int", parameter(method(model, owner + "finalParameter(int)"), "value").type().canonical());
        assertEquals(List.of("int[]", "int[][]"), parameterTypes(method(model, owner + "arrayParameters(int[],int[][])")));
        method(model, owner + "genericParameters(java.util.List`1[java.lang.Integer],java.util.Map`2[java.lang.String,java.util.List`1[java.lang.Integer]],java.lang.Iterable`1[java.lang.Integer])");
        method(model, owner + "delegateParameters(java.lang.Runnable,java.util.function.Function`2[java.lang.Integer,java.lang.Integer],java.util.function.Predicate`1[java.lang.Integer],java.util.function.Consumer`1[java.lang.Integer])");
        method(model, owner + "nestedTypeParameter(" + SHAPES + "ReturnTypes+NestedTypeForReturn)");
        method(model, owner + "enumParameter(" + SHAPES + "PlainEnumForMethods)");
        method(model, owner + "selfTypeParameter(" + SHAPES + "ParameterKinds)");
        method(model, owner + "interfaceParameter(java.lang.AutoCloseable)");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void parameterAnnotationsLandOnTheParameter(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        var annotated = parameter(method(model, SHAPES + "ParameterKinds#parameterWithAttribute(int)"), "value");
        assertTrue(annotation(annotated.annotations(), OWN_ANNOTATION).arguments().isEmpty());
        var variadic = parameter(method(model, SHAPES + "ParameterKinds#annotatedVarargsParameter(int[])"), "values");
        annotation(variadic.annotations(), OWN_ANNOTATION);
        assertTrue(variadic.variadic());
        assertTrue(parameter(method(model, SHAPES + "ParameterKinds#singleParameter(int)"), "value").annotations().isEmpty());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void overloadsAndVarargsSpellTheirParameterTypesInTheId(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        for (String overload : List.of("add(int)", "add(int,int)", "add(java.lang.String[])", "add(java.util.List`1[java.lang.Integer])")) {
            assertEquals("add", method(model, METHODS + "#" + overload).name());
        }
        assertEquals(4, model.nodes().stream().filter(n -> n.id().value().startsWith("M:" + METHODS + "#add(")).count());
        MethodNode sum = method(model, METHODS + "#sum(int[])");
        assertTrue(parameter(sum, "values").variadic());
        assertEquals("int[]", parameter(sum, "values").type().canonical());
        MethodNode format = method(model, METHODS + "#format(java.lang.String,java.lang.Object[])");
        assertFalse(parameter(format, "template").variadic());
        assertTrue(parameter(format, "arguments").variadic());
        assertEquals("int[]", method(model, METHODS + "#arrayReturn()").signature().returnType().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void annotationsOnMethodsCarryEnumAndLongArguments(EngineKind engine) {
        List<Annotation> annotations = method(Models.syntax(engine), METHODS + "#methodWithAttribute()").annotations();
        assertEquals(2, annotations.size());
        Annotation withDefaults = annotation(annotations, "T:" + SYNTAX + "types.InterfaceKinds+AnnotationWithDefaults");
        assertEquals(2, withDefaults.arguments().size());
        AnnotationValue kind = argument(withDefaults, "kind").value();
        assertTrue(kind instanceof AnnotationValue.EnumValue value && value.member().equals("METHOD") && value.type().canonical().equals("java.lang.annotation.ElementType"), kind.toString());
        assertEquals("1L", literal(withDefaults, "required"));
        Annotation deprecated = annotation(annotations, "T:java.lang.Deprecated");
        assertEquals("\"1\"", literal(deprecated, "since"));
        assertEquals("true", literal(deprecated, "forRemoval"));
    }

    @Test
    void aTypeUseAnnotationOnTheReturnTypeIsAReturnAnnotationInSource() {
        MethodNode method = method(Models.syntax(EngineKind.SOURCE), METHODS + "#methodWithReturnAttribute()");
        assertTrue(method.annotations().isEmpty());
        assertEquals(List.of("T:" + METHODS + "+TypeUseAnnotation"), method.signature().returnAnnotations().stream().map(a -> ((TypeRef.Named) a.type()).type().value()).collect(Collectors.toList()));
        assertEquals("java.lang.String", method.signature().returnType().canonical());
    }

    @Test
    void aTypeUseAnnotationOnTheReturnTypeIsNotInTheClassFileArchUnitReads() {
        MethodNode method = method(Models.syntax(EngineKind.BYTECODE), METHODS + "#methodWithReturnAttribute()");
        assertTrue(method.annotations().isEmpty());
        assertTrue(method.signature().returnAnnotations().isEmpty());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void objectMethodOverridesPointAtJavaLangObject(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        for (String owner : List.of(METHODS, SHAPES + "ObjectMethodOverrides")) {
            for (String name : List.of("toString()", "equals(java.lang.Object)", "hashCode()", "finalize()")) {
                assertEquals(List.of("M:java.lang.Object#" + name), overridesOf(model, "M:" + owner + "#" + name), owner + name);
            }
            MethodNode finalize = method(model, owner + "#finalize()");
            assertEquals(Visibility.PROTECTED_OR_NAMESPACE, finalize.visibility());
            assertEquals(List.of(Modifier.VIRTUAL), finalize.modifiers());
            Edge.UsesType test = one(usesTypes(model, "M:" + owner + "#equals(java.lang.Object)"), e -> true, "type test in equals");
            assertEquals(TypeUseRole.TYPE_TEST, test.role());
            assertEquals(owner, test.to().canonical());
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void recordStaticMethodsCallTheCanonicalConstructor(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String record = SHAPES + "MethodsInRecord";
        MethodNode factory = method(model, record + "#staticMethodInRecord()");
        assertEquals(List.of(Modifier.STATIC), factory.modifiers());
        assertEquals(record, factory.signature().returnType().canonical());
        Edge.Invokes creation = one(invokes(model, factory.id().value()), e -> true, "call from the factory");
        assertEquals("M:" + record + "#.ctor(int)", creation.to().value());
        assertEquals(List.of(Modifier.VIRTUAL), method(model, record + "#methodInRecord()").modifiers());
        assertEquals(true, method(model, record + "#value()").languageSpecific().get("java.isRecordComponent"));
    }

    @Test
    void fieldInitializersAreBodiesOfTheFieldInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        Edge.Invokes counter = one(invokes(model, "F:" + FIELDS + ".counter"), e -> true, "call from the initializer of counter");
        assertEquals("M:" + FIELDS + "#initialCounter()", counter.to().value());
        assertEquals(ExpressionKind.TYPE, counter.receiver());
        assertTrue(invokes(model, "F:" + FIELDS + ".delegateFieldWithMethodReferenceInitializer").isEmpty());
        assertTrue(invokes(model, "F:" + FIELDS + ".delegateFieldWithLambdaInitializer").isEmpty());
        Edge.Accesses enumRead = one(accesses(model, "F:" + FIELDS + ".ENUM_FIELD"), e -> true, "read from the initializer of ENUM_FIELD");
        assertEquals("F:" + SYNTAX + "types.EnumKinds+PlainEnum.FIRST", enumRead.to().value());
        assertEquals(AccessKind.READ, enumRead.access());
        Edge.Invokes lines = one(invokes(model, "F:" + FIELDS + ".lines"), e -> true, "call from the initializer of lines");
        assertEquals("M:java.util.ArrayList`1#.ctor()", lines.to().value());
        assertEquals(List.of("java.lang.String"), lines.typeArguments().stream().map(TypeRef::canonical).toList());
        Edge.UsesType names = one(usesTypes(model, "F:" + FIELDS + ".names"), e -> true, "array creation in the initializer of names");
        assertEquals(TypeUseRole.CREATION, names.role());
        assertEquals("java.lang.String[]", names.to().canonical());
        assertFalse(Models.has(model, "M:" + FIELDS + "#.cctor()"));
    }

    @Test
    void fieldInitializersAreCompiledIntoTheConstructorsInBytecode() {
        CodeModelFile model = Models.syntax(EngineKind.BYTECODE);
        List<Edge.Invokes> fromInitializer = invokes(model, "M:" + FIELDS + "#.cctor()");
        one(fromInitializer, e -> e.to().value().equals("M:" + FIELDS + "#initialCounter()"), "call to initialCounter from .cctor");
        List<Edge.Accesses> staticWrites = accesses(model, "M:" + FIELDS + "#.cctor()");
        one(staticWrites, e -> e.to().value().equals("F:" + FIELDS + ".counter") && e.access() == AccessKind.WRITE, "write of counter from .cctor");
        assertTrue(staticWrites.stream().noneMatch(e -> e.to().value().endsWith(".staticVolatileField")));
        assertTrue(invokes(model, "F:" + FIELDS + ".counter").isEmpty());
        one(accesses(model, "M:" + FIELDS + "#.ctor()"), e -> e.to().value().equals("F:" + FIELDS + ".fieldWithInitializer") && e.access() == AccessKind.WRITE, "write of fieldWithInitializer from .ctor");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constructorsWriteTheFieldsTheyInitialise(EngineKind engine) {
        List<Edge.Accesses> fromConstructor = accesses(Models.syntax(engine), "M:" + FIELDS + "#.ctor()");
        Edge.Accesses readonly = one(fromConstructor, e -> e.to().value().equals("F:" + FIELDS + ".readonlyField"), "access to readonlyField");
        assertEquals(AccessKind.WRITE, readonly.access());
        one(fromConstructor, e -> e.to().value().equals("F:" + FIELDS + ".fieldInitializedFromOtherFieldViaConstructor") && e.access() == AccessKind.WRITE, "write of the copied field");
        one(fromConstructor, e -> e.to().value().equals("F:" + FIELDS + ".fieldWithInitializer") && e.access() == AccessKind.READ, "read of fieldWithInitializer");
    }

    @Test
    void fieldAccessesInConstructorsHaveTheThisReceiverInSource() {
        List<Edge.Accesses> fromConstructor = accesses(Models.syntax(EngineKind.SOURCE), "M:" + FIELDS + "#.ctor()");
        assertEquals(3, fromConstructor.size());
        assertTrue(fromConstructor.stream().allMatch(e -> e.receiver() == ExpressionKind.THIS), fromConstructor.toString());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void lambdasInConstructorsReadFieldsViaClosure(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = FIELDS + "+FieldsWithInitializersReferencingMembers";
        List<Edge.Accesses> fromConstructor = accesses(model, "M:" + owner + "#.ctor()");
        one(fromConstructor, e -> e.to().value().equals("F:" + owner + ".first") && e.access() == AccessKind.READ && e.site().viaClosure(), "closure read of first");
        one(fromConstructor, e -> e.to().value().equals("F:" + owner + ".second") && e.access() == AccessKind.READ && e.site().viaClosure(), "closure read of second");
        one(fromConstructor, e -> e.to().value().equals("F:" + owner + ".first") && e.access() == AccessKind.READ && !e.site().viaClosure(), "direct read of first");
        one(fromConstructor, e -> e.to().value().equals("F:" + owner + ".closure") && e.access() == AccessKind.WRITE, "write of closure");
        assertEquals(3, Models.count(fromConstructor, e -> e.access() == AccessKind.WRITE));
        one(accesses(model, "M:" + owner + "#viaClosure()"), e -> e.to().value().equals("F:" + owner + ".closure") && e.access() == AccessKind.READ, "read of closure");
        one(invokes(model, "M:" + owner + "#viaClosure()"), e -> e.to().value().equals("M:java.util.function.Supplier`1#get()"), "call to Supplier.get");
        assertTrue(invokes(model, "M:" + owner + "#viaClosure()").stream().noneMatch(e -> e.site().viaClosure()));
    }
}
