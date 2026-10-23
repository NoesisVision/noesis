package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.scanner.core.Models.SYNTAX;
import static vision.noesis.scanner.core.Models.annotation;
import static vision.noesis.scanner.core.Models.argument;
import static vision.noesis.scanner.core.Models.contains;
import static vision.noesis.scanner.core.Models.extendsOf;
import static vision.noesis.scanner.core.Models.field;
import static vision.noesis.scanner.core.Models.implementsOf;
import static vision.noesis.scanner.core.Models.invokes;
import static vision.noesis.scanner.core.Models.literal;
import static vision.noesis.scanner.core.Models.method;
import static vision.noesis.scanner.core.Models.one;
import static vision.noesis.scanner.core.Models.overridesOf;
import static vision.noesis.scanner.core.Models.parameter;
import static vision.noesis.scanner.core.Models.type;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.scanner.model.Annotation;
import vision.noesis.scanner.model.AnnotationValue;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.ExpressionKind;
import vision.noesis.scanner.model.FieldKind;
import vision.noesis.scanner.model.FieldNode;
import vision.noesis.scanner.model.MethodKind;
import vision.noesis.scanner.model.MethodNode;
import vision.noesis.scanner.model.Modifier;
import vision.noesis.scanner.model.Origin;
import vision.noesis.scanner.model.TypeKind;
import vision.noesis.scanner.model.TypeNode;
import vision.noesis.scanner.model.TypeParameterConstraint;
import vision.noesis.scanner.model.TypeRef;
import vision.noesis.scanner.model.Visibility;

/** Facts about type declarations, pinned against both engines wherever the class file holds them. */
class TypeFactsTest {

    private static final String TYPES = SYNTAX + "types.";
    private static final String CLASSES = TYPES + "ClassKinds+";
    private static final String ENUMS = TYPES + "EnumKinds+";
    private static final String RECORDS = TYPES + "RecordKinds+";
    private static final String FUNCTIONS = TYPES + "FunctionalInterfaceKinds+";
    private static final String LOCALS = SYNTAX + "members.LocalFunctionsAndLambdas";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aPlainClassIsDeclaredWithItsKindVisibilityModifiersAndFile(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode plain = type(model, CLASSES + "PlainClass");
        assertEquals("PlainClass", plain.name());
        assertEquals(TypeKind.CLASS, plain.typeKind());
        assertEquals(Visibility.PUBLIC, plain.visibility());
        assertEquals(List.of(Modifier.STATIC), plain.modifiers());
        assertEquals(Origin.DECLARED, plain.origin());
        assertEquals(1, plain.locations().size());
        assertTrue(plain.locations().get(0).file().endsWith("fixture/syntax/types/ClassKinds.java"), plain.locations().get(0).file());
        assertEquals(List.of(Modifier.FINAL), type(model, TYPES + "ClassKinds").modifiers());
        assertEquals("types", Models.namespace(model, TYPES.substring(0, TYPES.length() - 1)).name());
        assertTrue(contains(model, "N:" + TYPES.substring(0, TYPES.length() - 1), "T:" + TYPES + "ClassKinds"));
        assertTrue(contains(model, "T:" + TYPES + "ClassKinds", "T:" + CLASSES + "PlainClass"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void nestedTypeVisibilityNamesTheScope(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(Visibility.PUBLIC, type(model, CLASSES + "PlainClass").visibility());
        assertEquals(Visibility.PRIVATE, type(model, CLASSES + "PrivateNestedClass").visibility());
        assertEquals(Visibility.PROTECTED_OR_NAMESPACE, type(model, CLASSES + "ProtectedNestedClass").visibility());
        assertEquals(Visibility.NAMESPACE, type(model, CLASSES + "PackagePrivateClass").visibility());
        assertEquals(Visibility.NAMESPACE, type(model, TYPES + "InterfaceKinds+PackagePrivateInterface").visibility());
        assertEquals(Visibility.NAMESPACE, type(model, ENUMS + "InternalEnum").visibility());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void modifiersAndSealedPermitsAreFacts(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(Modifier.STATIC, Modifier.ABSTRACT), type(model, CLASSES + "AbstractClass").modifiers());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL), type(model, CLASSES + "FinalClass").modifiers());
        assertEquals(List.of(), type(model, CLASSES + "InnerClass").modifiers());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL, Modifier.RECORD), type(model, RECORDS + "PlainRecord").modifiers());
        TypeNode shape = type(model, CLASSES + "Shape");
        assertEquals(TypeKind.INTERFACE, shape.typeKind());
        assertEquals(List.of(CLASSES + "Circle", CLASSES + "Square", CLASSES + "Polygon"), shape.languageSpecific().get("java.permits"));
        TypeNode polygon = type(model, CLASSES + "Polygon");
        assertEquals(List.of(Modifier.STATIC, Modifier.ABSTRACT), polygon.modifiers());
        assertEquals(List.of(CLASSES + "Triangle"), polygon.languageSpecific().get("java.permits"));
        assertNull(type(model, CLASSES + "Triangle").languageSpecific().get("java.permits"));
    }

    @Test
    void nonSealedIsASourceOnlyBagKey() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertEquals(true, type(model, CLASSES + "Square").languageSpecific().get("java.nonSealed"));
        assertNull(type(model, CLASSES + "Circle").languageSpecific().get("java.nonSealed"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void nestedTypesKeepTheirOuterPathAndAreContainedByIt(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String outer = CLASSES + "OuterClassWithNestedTypes";
        assertEquals("Deeper", type(model, outer + "+DeeplyNested+Deeper").name());
        assertTrue(contains(model, "T:" + outer, "T:" + outer + "+DeeplyNested"));
        assertTrue(contains(model, "T:" + outer + "+DeeplyNested", "T:" + outer + "+DeeplyNested+Deeper"));
        assertFalse(contains(model, "T:" + outer, "T:" + outer + "+DeeplyNested+Deeper"));
        TypeNode generic = type(model, outer + "+GenericNestedClass`1");
        assertEquals("GenericNestedClass", generic.name());
        assertEquals("T", generic.typeParameters().get(0).name());
        assertEquals(0, generic.typeParameters().get(0).ordinal());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void nestedTypeKindsCoverInterfaceEnumRecordAndAnnotation(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String outer = CLASSES + "OuterClassWithNestedTypes+";
        assertEquals(TypeKind.INTERFACE, type(model, outer + "NestedInterface").typeKind());
        TypeNode nestedEnum = type(model, outer + "NestedEnum");
        assertEquals(TypeKind.ENUM, nestedEnum.typeKind());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL), nestedEnum.modifiers());
        TypeNode record = type(model, outer + "NestedRecord");
        assertEquals(TypeKind.CLASS, record.typeKind());
        assertTrue(record.modifiers().contains(Modifier.RECORD));
        TypeNode annotation = type(model, outer + "NestedAnnotation");
        assertEquals(TypeKind.INTERFACE, annotation.typeKind());
        assertEquals(true, annotation.languageSpecific().get("java.isAnnotation"));
        assertNull(type(model, outer + "NestedInterface").languageSpecific().get("java.isAnnotation"));
        annotation(type(model, outer + "NestedFunction").annotations(), "T:java.lang.FunctionalInterface");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void objectBaseIsNeverAnEdgeAndEnumsAndRecordsExtendTheirJdkBase(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(), extendsOf(model, "T:" + CLASSES + "PlainClass"));
        assertEquals(List.of(), extendsOf(model, "T:" + CLASSES + "ClassWithExplicitObjectBase"));
        assertEquals(List.of("java.lang.Enum`1[" + ENUMS + "PlainEnum]"), extendsOf(model, "T:" + ENUMS + "PlainEnum"));
        assertEquals(List.of("java.lang.Record"), extendsOf(model, "T:" + RECORDS + "PlainRecord"));
        assertEquals(List.of(TYPES + "InterfaceKinds+PlainInterface"), implementsOf(model, "T:" + ENUMS + "EnumImplementingInterface"));
        assertEquals(List.of("java.util.function.Function`2[java.lang.Integer,java.lang.Integer]"), extendsOf(model, "T:" + FUNCTIONS + "FunctionExtendingLibraryInterface"));
        assertEquals(List.of(CLASSES + "Polygon"), extendsOf(model, "T:" + CLASSES + "Triangle"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void packagePrivateTopLevelTypesInAnotherClassFileAreNamespaceVisibleNodes(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode fileLocal = type(model, TYPES + "FileLocalClass");
        assertEquals(Visibility.NAMESPACE, fileLocal.visibility());
        assertEquals(List.of(), fileLocal.modifiers());
        assertTrue(contains(model, "N:" + SYNTAX + "types", "T:" + TYPES + "FileLocalClass"));
        assertEquals(TypeKind.INTERFACE, type(model, TYPES + "FileLocalInterface").typeKind());
        assertEquals(List.of(Modifier.FINAL), type(model, TYPES + "FileLocalEnum").modifiers());
        assertEquals(List.of(Modifier.FINAL, Modifier.RECORD), type(model, TYPES + "FileLocalRecord").modifiers());
        assertEquals(Visibility.NAMESPACE, type(model, TYPES + "FileLocalStaticClass").visibility());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void typesNestedInAnInterfaceAreImplicitlyPublicAndStatic(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode nestedClass = type(model, CLASSES + "InterfaceWithNestedTypes+ClassNestedInInterface");
        assertEquals(Visibility.PUBLIC, nestedClass.visibility());
        assertEquals(List.of(Modifier.STATIC), nestedClass.modifiers());
        TypeNode nestedEnum = type(model, CLASSES + "InterfaceWithNestedTypes+EnumNestedInInterface");
        assertEquals(Visibility.PUBLIC, nestedEnum.visibility());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL), nestedEnum.modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void localTypesAreNodesEnclosedByTheirMethodAndStaticUnlessTheyAreClasses(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String enclosing = "M:" + LOCALS + "#methodWithLocalFunctions(int)";
        TypeNode localEnum = type(model, LOCALS + "+1LocalEnumFunction");
        assertEquals("LocalEnumFunction", localEnum.name());
        assertEquals(TypeKind.ENUM, localEnum.typeKind());
        assertEquals(Visibility.PRIVATE, localEnum.visibility());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL), localEnum.modifiers());
        assertEquals(true, localEnum.languageSpecific().get("java.isLocal"));
        assertEquals(enclosing, localEnum.languageSpecific().get("java.enclosingMethod"));
        assertTrue(contains(model, "T:" + LOCALS, "T:" + LOCALS + "+1LocalEnumFunction"));
        assertEquals(List.of(Modifier.STATIC), type(model, LOCALS + "+1LocalInterfaceFunction").modifiers());
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL, Modifier.RECORD), type(model, LOCALS + "+1StaticLocalFunction").modifiers());
        TypeNode localClass = type(model, LOCALS + "+1BlockBodiedLocalFunction");
        assertEquals(List.of(), localClass.modifiers());
        assertEquals(enclosing, localClass.languageSpecific().get("java.enclosingMethod"));
        annotation(type(model, LOCALS + "+1LocalFunctionWithAttribute").annotations(), "T:" + SYNTAX + "annotations.OwnAnnotation");
        TypeNode inner = type(model, LOCALS + "+1NestedLocalFunctionOuter+1NestedLocalFunctionInner");
        assertEquals("M:" + LOCALS + "+1NestedLocalFunctionOuter#invoke()", inner.languageSpecific().get("java.enclosingMethod"));
        assertTrue(contains(model, "T:" + LOCALS + "+1NestedLocalFunctionOuter", inner.id().value()));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void anonymousClassesAreNumberedPrivateNodesEnclosedByTheirMethod(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = TYPES + "LocalAndAnonymousClasses";
        TypeNode first = type(model, owner + "+1");
        assertEquals("1", first.name());
        assertEquals(Visibility.PRIVATE, first.visibility());
        assertEquals(List.of(), first.modifiers());
        assertEquals(true, first.languageSpecific().get("java.isAnonymous"));
        assertNull(first.languageSpecific().get("java.isLocal"));
        assertEquals("M:" + owner + "#anonymousClass()", first.languageSpecific().get("java.enclosingMethod"));
        assertEquals("M:" + owner + "#anonymousSubclass()", type(model, owner + "+2").languageSpecific().get("java.enclosingMethod"));
        assertTrue(contains(model, "T:" + owner, "T:" + owner + "+1"));
        assertEquals("M:" + LOCALS + "#methodWithLambdas()", type(model, LOCALS + "+2").languageSpecific().get("java.enclosingMethod"));
        TypeNode localRecord = type(model, owner + "+1LocalRecord");
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL, Modifier.RECORD), localRecord.modifiers());
        assertEquals("M:" + owner + "#localRecord(int)", localRecord.languageSpecific().get("java.enclosingMethod"));
    }

    @Test
    void aClassInAFieldInitializerIsEnclosedByTheFieldOnlyInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertEquals("F:" + CLASSES + "ClassUsingFileLocalClass.fileLocalInterfaceInstance", type(model, CLASSES + "ClassUsingFileLocalClass+1").languageSpecific().get("java.enclosingMethod"));
        assertEquals("F:" + TYPES + "BuiltInAndSpecialTypes+AnonymousAndImplicitTypes+1.anonymousNested", type(model, TYPES + "BuiltInAndSpecialTypes+AnonymousAndImplicitTypes+1+1").languageSpecific().get("java.enclosingMethod"));
        assertEquals("F:" + ENUMS + "EnumWithConstantBodies.ONE", type(model, ENUMS + "EnumWithConstantBodies+1").languageSpecific().get("java.enclosingMethod"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void enumConstantsAreStaticReadonlyMembersOfTheirOwnTypeWithoutConstantText(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        FieldNode first = field(model, ENUMS + "PlainEnum.FIRST");
        assertEquals(FieldKind.ENUM_MEMBER, first.fieldKind());
        assertEquals(Visibility.PUBLIC, first.visibility());
        assertEquals(List.of(Modifier.STATIC, Modifier.READONLY), first.modifiers());
        assertEquals(ENUMS + "PlainEnum", first.type().canonical());
        assertNull(first.constantValue());
        FieldNode label = field(model, ENUMS + "EnumWithFieldsAndConstructor.LABEL");
        assertEquals(FieldKind.FIELD, label.fieldKind());
        assertEquals("\"weight\"", label.constantValue());
        assertEquals(List.of(Modifier.READONLY), field(model, ENUMS + "EnumWithFieldsAndConstructor.weight").modifiers());
        annotation(field(model, ENUMS + "EnumWithAttributedMembers.OBSOLETE_MEMBER").annotations(), "T:java.lang.Deprecated");
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void enumsGetGeneratedValuesAndValueOfAndKeepTheirPrivateConstructor(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode values = method(model, ENUMS + "PlainEnum#values()");
        assertEquals(Origin.GENERATED, values.origin());
        assertEquals(List.of(Modifier.STATIC), values.modifiers());
        assertEquals(ENUMS + "PlainEnum[]", values.signature().returnType().canonical());
        assertTrue(values.locations().isEmpty());
        MethodNode valueOf = method(model, ENUMS + "PlainEnum#valueOf(java.lang.String)");
        assertEquals(Origin.GENERATED, valueOf.origin());
        assertEquals("name", valueOf.signature().parameters().get(0).name());
        MethodNode constructor = method(model, ENUMS + "EnumWithExplicitValues#.ctor(int)");
        assertEquals(MethodKind.CONSTRUCTOR, constructor.methodKind());
        assertEquals(Visibility.PRIVATE, constructor.visibility());
        assertEquals(Origin.DECLARED, constructor.origin());
        assertEquals(Visibility.PRIVATE, method(model, ENUMS + "PlainEnum#.ctor()").visibility());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void enumConstantBodiesAreAnonymousEnumSubclassesPermittedByTheirEnum(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode owner = type(model, ENUMS + "EnumWithConstantBodies");
        assertEquals(List.of(Modifier.STATIC, Modifier.ABSTRACT), owner.modifiers());
        assertEquals(List.of(ENUMS + "EnumWithConstantBodies+1", ENUMS + "EnumWithConstantBodies+2"), owner.languageSpecific().get("java.permits"));
        TypeNode body = type(model, ENUMS + "EnumWithConstantBodies+1");
        assertEquals(TypeKind.ENUM, body.typeKind());
        assertEquals(Visibility.PRIVATE, body.visibility());
        assertEquals(List.of(Modifier.FINAL), body.modifiers());
        assertEquals(true, body.languageSpecific().get("java.isAnonymous"));
        assertEquals(List.of(ENUMS + "EnumWithConstantBodies"), extendsOf(model, body.id().value()));
        MethodNode number = method(model, ENUMS + "EnumWithConstantBodies+1#number()");
        assertEquals(Visibility.NAMESPACE, number.visibility());
        assertEquals(List.of(Modifier.VIRTUAL), number.modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void recordsSynthesiseTheirCanonicalConstructorAccessorsAndObjectMethods(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String record = RECORDS + "PlainRecord";
        FieldNode component = field(model, record + ".id");
        assertEquals(Visibility.PRIVATE, component.visibility());
        assertEquals(List.of(Modifier.READONLY), component.modifiers());
        assertEquals("int", component.type().canonical());
        assertEquals(true, component.languageSpecific().get("java.isRecordComponent"));
        MethodNode accessor = method(model, record + "#id()");
        assertEquals(List.of(Modifier.VIRTUAL), accessor.modifiers());
        assertEquals(true, accessor.languageSpecific().get("java.isRecordComponent"));
        MethodNode constructor = method(model, record + "#.ctor(int,java.lang.String)");
        assertEquals(Visibility.PUBLIC, constructor.visibility());
        assertEquals(List.of("id", "name"), constructor.signature().parameters().stream().map(p -> p.name()).toList());
        MethodNode equals = method(model, record + "#equals(java.lang.Object)");
        assertEquals(List.of(Modifier.FINAL), equals.modifiers());
        assertEquals("o", equals.signature().parameters().get(0).name());
        assertEquals(List.of("M:java.lang.Record#equals(java.lang.Object)"), overridesOf(model, equals.id().value()));
        assertEquals(List.of("M:java.lang.Record#hashCode()"), overridesOf(model, "M:" + record + "#hashCode()"));
        assertEquals(List.of("M:java.lang.Record#toString()"), overridesOf(model, "M:" + record + "#toString()"));
        assertEquals(List.of("M:java.lang.Record#toString()"), overridesOf(model, "M:" + RECORDS + "RecordWithExplicitToString#toString()"));
        assertEquals(Origin.DECLARED, method(model, RECORDS + "RecordWithExplicitToString#toString()").origin());
    }

    @Test
    void implicitRecordAndEnumMembersAreGeneratedOnlyInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertEquals(Origin.GENERATED, method(model, RECORDS + "PlainRecord#.ctor(int,java.lang.String)").origin());
        assertEquals(Origin.GENERATED, method(model, RECORDS + "PlainRecord#equals(java.lang.Object)").origin());
        assertTrue(method(model, RECORDS + "PlainRecord#toString()").locations().isEmpty());
        assertEquals(Origin.GENERATED, method(model, ENUMS + "PlainEnum#.ctor()").origin());
        assertEquals(Origin.GENERATED, method(model, RECORDS + "RecordWithPositionalAndBodyMembers#.ctor(int,int)").origin());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void recordConstructorsAreCompactExplicitOrNonCanonical(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(Origin.DECLARED, method(model, RECORDS + "RecordWithCompactConstructor#.ctor(java.lang.String)").origin());
        assertEquals(Origin.DECLARED, method(model, RECORDS + "RecordWithExplicitCanonicalConstructor#.ctor(int)").origin());
        String record = RECORDS + "RecordWithPositionalAndBodyMembers";
        assertEquals(Origin.DECLARED, method(model, record + "#.ctor(int)").origin());
        assertEquals(2, model.nodes().stream().filter(n -> n.id().value().startsWith("M:" + record + "#.ctor(")).count());
        var chained = one(invokes(model, "M:" + record + "#.ctor(int)"), e -> true, "call from the non-canonical constructor");
        assertEquals("M:" + record + "#.ctor(int,int)", chained.to().value());
        assertEquals(ExpressionKind.THIS, chained.receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aVarargsComponentIsAnArrayFieldAndAVariadicConstructorParameter(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String record = RECORDS + "RecordWithVarargsComponent";
        var values = parameter(method(model, record + "#.ctor(int[])"), "values");
        assertTrue(values.variadic());
        assertTrue(values.type() instanceof TypeRef.Array array && array.rank() == 1 && array.element() instanceof TypeRef.Primitive, values.type().toString());
        assertEquals("int[]", field(model, record + ".values").type().canonical());
        assertEquals("int[]", method(model, record + "#values()").signature().returnType().canonical());
        TypeNode nested = type(model, RECORDS + "RecordWithNestedRecord+NestedRecordInRecord");
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL, Modifier.RECORD), nested.modifiers());
        assertTrue(contains(model, "T:" + RECORDS + "RecordWithNestedRecord", nested.id().value()));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void functionalInterfacesHaveOneAbstractMethodBesideDefaultAndStaticHelpers(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode function = type(model, FUNCTIONS + "VoidFunctionWithoutParameters");
        assertEquals(TypeKind.INTERFACE, function.typeKind());
        assertEquals(List.of(Modifier.STATIC), function.modifiers());
        annotation(function.annotations(), "T:java.lang.FunctionalInterface");
        MethodNode invoke = method(model, FUNCTIONS + "VoidFunctionWithoutParameters#invoke()");
        assertTrue(invoke.bodiless());
        assertEquals(List.of(Modifier.ABSTRACT), invoke.modifiers());
        assertEquals(Visibility.PUBLIC, invoke.visibility());
        String mixed = FUNCTIONS + "FunctionWithDefaultAndStaticMethods#";
        assertTrue(method(model, mixed + "apply(int)").bodiless());
        MethodNode defaulted = method(model, mixed + "applyTwice(int)");
        assertFalse(defaulted.bodiless());
        assertEquals(List.of(Modifier.VIRTUAL), defaulted.modifiers());
        assertEquals(List.of(Modifier.STATIC), method(model, mixed + "identity()").modifiers());
        assertEquals(Visibility.NAMESPACE, type(model, FUNCTIONS + "PackagePrivateFunction").visibility());
        var bound = type(model, FUNCTIONS + "GenericFunctionWithBound`1").typeParameters().get(0).constraints();
        assertEquals(1, bound.size());
        assertTrue(bound.get(0) instanceof TypeParameterConstraint.TypeConstraint constraint && constraint.type().canonical().equals("java.lang.Number"), bound.toString());
        assertTrue(parameter(method(model, FUNCTIONS + "FunctionWithVarargs#accept(int[])"), "values").variadic());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void annotationsOnTypesCarryNamedArgumentsAndRepeatsInsideTheirContainer(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Annotation> annotations = type(model, CLASSES + "ClassWithAttributes").annotations();
        assertEquals(3, annotations.size());
        Annotation deprecated = annotation(annotations, "T:java.lang.Deprecated");
        assertEquals("\"1\"", literal(deprecated, "since"));
        assertEquals("true", literal(deprecated, "forRemoval"));
        assertEquals("2", literal(annotation(annotations, "T:" + SYNTAX + "annotations.OwnAnnotation"), "priority"));
        Annotation container = annotation(annotations, "T:" + CLASSES + "CustomAnnotationWithUsage+Container");
        var repeats = ((AnnotationValue.Array) argument(container, "value").value()).items().stream().map(item -> ((AnnotationValue.Nested) item).annotation()).toList();
        assertEquals(2, repeats.size());
        assertEquals("\"first\"", literal(repeats.get(0), "value"));
        assertEquals("1", literal(repeats.get(0), "namedArgument"));
        assertEquals("\"second\"", literal(repeats.get(1), "value"));
        assertEquals(1, repeats.get(1).arguments().size());
        assertEquals("\"flags\"", literal(annotation(type(model, ENUMS + "AnnotatedEnum").annotations(), "T:" + SYNTAX + "annotations.OwnAnnotation"), "value"));
        TypeNode repeatable = type(model, CLASSES + "CustomAnnotationWithUsage");
        assertEquals(true, repeatable.languageSpecific().get("java.isAnnotation"));
        var target = argument(annotation(repeatable.annotations(), "T:java.lang.annotation.Repeatable"), "value").value();
        assertEquals("T:" + CLASSES + "CustomAnnotationWithUsage+Container", ((TypeRef.Named) ((AnnotationValue.TypeValue) target).type()).type().value());
    }

    @Test
    void positionalArgumentsAndSourceRetainedAnnotationsAreSourceFacts() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        Annotation own = annotation(type(model, ENUMS + "AnnotatedEnum").annotations(), "T:" + SYNTAX + "annotations.OwnAnnotation");
        assertTrue(argument(own, "value").positional());
        assertFalse(argument(annotation(type(model, CLASSES + "ClassWithAttributes").annotations(), "T:java.lang.Deprecated"), "since").positional());
        Annotation suppress = annotation(type(model, CLASSES + "StrictClass").annotations(), "T:java.lang.SuppressWarnings");
        var items = ((AnnotationValue.Array) argument(suppress, "value").value()).items();
        assertEquals(List.of(new AnnotationValue.Literal("\"strictfp\"")), items);
        assertTrue(type(Models.syntax(EngineKind.BYTECODE), CLASSES + "StrictClass").annotations().isEmpty());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void builtInAndSpecialTypesHaveOneCanonicalForm(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = TYPES + "BuiltInAndSpecialTypes+BuiltInTypesAsFields.";
        Map<String, String> expected = Map.ofEntries(
                Map.entry("boolField", "boolean"), Map.entry("byteField", "byte"), Map.entry("charField", "char"), Map.entry("shortField", "short"),
                Map.entry("intField", "int"), Map.entry("longField", "long"), Map.entry("floatField", "float"), Map.entry("doubleField", "double"),
                Map.entry("objectField", "java.lang.Object"), Map.entry("stringField", "java.lang.String"), Map.entry("stringFieldViaQualifiedName", "java.lang.String"),
                Map.entry("fullyQualifiedObjectField", "java.lang.Object"), Map.entry("nullableIntField", "java.lang.Integer"), Map.entry("boxedBooleanField", "java.lang.Boolean"),
                Map.entry("singleDimensionalArrayField", "int[]"), Map.entry("jaggedArrayField", "int[][]"), Map.entry("threeDimensionalArrayField", "int[][][]"),
                Map.entry("arrayOfNullableIntsField", "java.lang.Integer[]"), Map.entry("charArrayField", "char[]"), Map.entry("objectArrayField", "java.lang.Object[]"),
                Map.entry("referenceTupleField", "java.util.Map`2+Entry`2[java.lang.Integer,java.lang.String]"), Map.entry("genericListField", "java.util.List`1[java.lang.Integer]"),
                Map.entry("nestedGenericField", "java.util.Map`2[java.lang.String,java.util.List`1[java.lang.Integer]]"),
                Map.entry("genericInterfaceField", "java.lang.Iterable`1[java.util.Map`2+Entry`2[java.lang.String,int[]]]"),
                Map.entry("memoryField", "java.nio.ByteBuffer"), Map.entry("readOnlyMemoryField", "java.nio.CharBuffer"),
                Map.entry("funcField", "java.util.function.Function`2[java.lang.Integer,java.lang.String]"), Map.entry("actionField", "java.lang.Runnable"),
                Map.entry("predicateField", "java.util.function.Predicate`1[java.lang.Integer]"), Map.entry("typeField", "java.lang.Class`1[<other:?>]"),
                Map.entry("boundedTypeField", "java.lang.Class`1[<other:? extends java.lang.Number>]"), Map.entry("enumBaseTypeField", "java.lang.Enum`1[<other:?>]"),
                Map.entry("valueTypeBaseTypeField", "java.lang.Number"), Map.entry("taskField", "java.util.concurrent.CompletableFuture`1[java.lang.Void]"),
                Map.entry("valueTaskField", "java.util.concurrent.Future`1[java.lang.Integer]"), Map.entry("lazyField", "java.util.function.Supplier`1[java.lang.String]"),
                Map.entry("optionalField", "java.util.Optional`1[java.lang.String]"), Map.entry("dateTimeField", "java.time.LocalDateTime"),
                Map.entry("dateOnlyField", "java.time.LocalDate"), Map.entry("timeOnlyField", "java.time.LocalTime"), Map.entry("timeSpanField", "java.time.Duration"),
                Map.entry("dateTimeOffsetField", "java.time.OffsetDateTime"), Map.entry("guidField", "java.util.UUID"), Map.entry("bigIntegerField", "java.math.BigInteger"),
                Map.entry("lockField", "java.util.concurrent.locks.ReentrantLock"), Map.entry("exceptionField", "java.lang.Exception"), Map.entry("voidField", "java.lang.Void"),
                Map.entry("nestedTypeField", CLASSES + "OuterClassWithNestedTypes+DeeplyNested"),
                Map.entry("genericNestedTypeField", CLASSES + "OuterClassWithNestedTypes+GenericNestedClass`1[java.lang.String]"),
                Map.entry("deeplyNestedGenericField", RECORDS + "GenericRecord`1[java.util.List`1[" + RECORDS + "PlainRecord]]"));
        expected.forEach((name, canonical) -> assertEquals(canonical, field(model, owner + name).type().canonical(), name));
        assertEquals(50, model.nodes().stream().filter(n -> n.id().value().startsWith("F:" + owner)).count());
        assertTrue(field(model, owner + "boolField").type() instanceof TypeRef.Primitive);
        assertTrue(field(model, owner + "voidField").type() instanceof TypeRef.Named);
        assertTrue(field(model, owner + "threeDimensionalArrayField").type() instanceof TypeRef.Array outer && outer.rank() == 1 && outer.element() instanceof TypeRef.Array);
        assertTrue(((TypeRef.Named) field(model, owner + "typeField").type()).typeArguments().get(0) instanceof TypeRef.Other other && other.text().equals("?"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void anonymousTypesCreatedInAMethodAreNestedNodesWithTheirOwnFields(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = TYPES + "BuiltInAndSpecialTypes+AnonymousAndImplicitTypes";
        TypeNode outer = type(model, owner + "+1");
        assertEquals(Visibility.PRIVATE, outer.visibility());
        assertEquals(true, outer.languageSpecific().get("java.isAnonymous"));
        assertEquals("M:" + owner + "#createAnonymousType()", outer.languageSpecific().get("java.enclosingMethod"));
        FieldNode property = field(model, owner + "+1.anonymousProperty");
        assertEquals(Visibility.NAMESPACE, property.visibility());
        assertEquals(List.of(Modifier.READONLY), property.modifiers());
        assertEquals("1", property.constantValue());
        assertEquals("java.lang.Object", field(model, owner + "+1.anonymousNested").type().canonical());
        assertEquals("\"\"", field(model, owner + "+1+1.inner").constantValue());
        assertEquals("1", type(model, owner + "+1+1").name());
        assertTrue(contains(model, "T:" + owner + "+1", "T:" + owner + "+1+1"));
    }
}
