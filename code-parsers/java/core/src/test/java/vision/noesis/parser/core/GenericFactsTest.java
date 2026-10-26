package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.TypeKind;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeParameter;
import vision.noesis.parser.model.TypeRef;

/** Generics as the .NET parser's GenericTests pin them: parameter ids, constraints, shadowing, invocations and constructed types. */
class GenericFactsTest {

    private static final String GM = Models.SYNTAX + "generics.GenericMethods";
    private static final String GT = Models.SYNTAX + "generics.GenericTypes+";
    private static final String ONE = GT + "GenericClassWithOneParameter`1";
    private static final String INVOCATIONS = "M:" + GM + "+GenericMethodInvocations#invokeWithInferredAndExplicitTypeArguments()";
    private static final String CALLERS = "M:" + GM + "#callers(java.util.Map`2[java.lang.String,java.lang.Integer])";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericMethodsNameTheirParametersWithTwoBangs(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode identity = Models.method(model, GM + "#identity`1(!!0)");
        assertEquals(List.of("T"), identity.typeParameters().stream().map(TypeParameter::name).toList());
        assertEquals(0, identity.typeParameters().get(0).ordinal());
        assertEquals(identity.id(), ((TypeRef.TypeParameterRef) identity.signature().parameters().get(0).type()).owner());
        MethodNode two = Models.method(model, GM + "#genericMethodWithTwoParameters`2(!!0,java.util.function.Function`2[!!0,!!1])");
        assertEquals(List.of("A", "R"), two.typeParameters().stream().map(TypeParameter::name).toList());
        assertEquals("!!1", two.signature().returnType().canonical());
        MethodNode unused = Models.method(model, GM + "#genericMethodWithoutUsingParameterInSignature`1()");
        assertEquals(1, unused.typeParameters().size());
        assertEquals(List.of(), unused.signature().parameters());
        MethodNode array = Models.method(model, GM + "#genericMethodWithArrayReturn`1(!!0[])");
        assertEquals("!!0[]", array.signature().returnType().canonical());
        assertTrue(array.signature().parameters().get(0).variadic());
        assertEquals("java.util.List`1[!!0]", Models.method(model, GM + "#genericMethodWithGenericReturn`1(java.lang.Iterable`1[!!0])").signature().returnType().canonical());
        MethodNode entries = Models.method(model, GM + "#genericMethodWithTwoParametersAndNestedGeneric`2(java.lang.Iterable`1[java.util.Map`2+Entry`2[!!0,!!1]])");
        assertEquals("java.util.Map`2[!!0,!!1]", entries.signature().returnType().canonical());
        MethodNode async = Models.method(model, GM + "#asyncGenericMethod`1(!!0)");
        assertEquals("java.util.concurrent.CompletableFuture`1[!!0]", async.signature().returnType().canonical());
        assertEquals(List.of(Modifier.VIRTUAL), async.modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void methodConstraintsKeepTheirKindsAndOrder(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("java.lang.Number", "java.lang.Comparable`1[!!0]"), Models.constraintsOf(Models.method(model, GM + "#genericMethodWithMultipleConstraints`1(!!0)").typeParameters().get(0)));
        MethodNode dependent = Models.method(model, GM + "#genericMethodWithDependentConstraint`2(!!1)");
        TypeParameter d = dependent.typeParameters().get(1);
        assertEquals("D", d.name());
        assertEquals(1, d.ordinal());
        assertEquals(List.of("!!0"), Models.constraintsOf(d));
        assertEquals(List.of(), Models.constraintsOf(dependent.typeParameters().get(0)));
        assertEquals(List.of("java.lang.Enum`1[!!0]"), Models.constraintsOf(Models.method(model, GM + "#genericMethodWithEnumConstraint`1(java.lang.Class`1[!!0],java.lang.String)").typeParameters().get(0)));
        assertEquals(List.of("java.lang.Comparable`1[!!1]"), Models.constraintsOf(Models.method(model, GM + "#maxValue`2(java.util.Map`2[!!0,!!1])").typeParameters().get(1)));
        assertEquals(List.of(), Models.constraintsOf(Models.method(model, GM + "#genericMethodWithNewConstraint`1(java.util.function.Supplier`1[!!0])").typeParameters().get(0)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void classConstraintsKeepTheirKindsAndOrder(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("java.lang.Exception", "java.lang.AutoCloseable", "java.lang.Comparable`1[!0]"), Models.constraintsOf(Models.type(model, GT + "GenericClassWithMultipleConstraints`1").typeParameters().get(0)));
        TypeNode dependent = Models.type(model, GT + "GenericClassWithDependentConstraint`2");
        assertEquals(List.of("!0"), Models.constraintsOf(dependent.typeParameters().get(1)));
        assertEquals(List.of("java.lang.Iterable`1[java.lang.Integer]"), Models.constraintsOf(Models.type(model, GT + "GenericClassWithGenericTypeConstraint`1").typeParameters().get(0)));
        assertEquals(List.of("java.lang.Number", "java.lang.Comparable`1[!0]"), Models.constraintsOf(Models.type(model, GT + "BoundedGeneric`1").typeParameters().get(0)));
        assertEquals(List.of(GT + "SelfBounded`1[!0]"), Models.constraintsOf(Models.type(model, GT + "SelfBounded`1").typeParameters().get(0)));
        TypeNode both = Models.type(model, GT + "GenericClassWithConstraintsOnBothParameters`2");
        assertEquals(List.of("java.lang.Number"), Models.constraintsOf(both.typeParameters().get(0)));
        assertEquals(List.of("java.lang.CharSequence"), Models.constraintsOf(both.typeParameters().get(1)));
        assertEquals(List.of("java.lang.Exception"), Models.constraintsOf(Models.type(model, GT + "GenericClassWithBaseClassConstraint`1").typeParameters().get(0)));
        assertEquals(List.of("java.lang.AutoCloseable"), Models.constraintsOf(Models.type(model, GT + "GenericClassWithInterfaceConstraint`1").typeParameters().get(0)));
        assertEquals(List.of("java.lang.Enum`1[!0]"), Models.constraintsOf(Models.type(model, GT + "GenericClassWithEnumConstraint`1").typeParameters().get(0)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void classAndMethodParametersAreToldApartInOneSignature(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = GM + "+GenericClassWithGenericMethods`1";
        MethodNode mixing = Models.method(model, owner + "#methodMixingClassAndMethodParameters`1(!!0)");
        TypeRef.Named entry = (TypeRef.Named) mixing.signature().returnType();
        assertEquals("java.util.Map`2+Entry`2[!0,!!0]", entry.canonical());
        assertEquals("T:" + owner, ((TypeRef.TypeParameterRef) entry.typeArguments().get(0)).owner().value());
        assertEquals(mixing.id(), ((TypeRef.TypeParameterRef) entry.typeArguments().get(1)).owner());
        assertEquals(List.of("!0"), Models.constraintsOf(Models.method(model, owner + "#methodWithConstraintReferencingClassParameter`1(!!0)").typeParameters().get(0)));
        assertEquals("!!0", Models.method(model, owner + "#methodWithOwnParameter`1(!!0)").signature().returnType().canonical());
        assertEquals("!0", Models.field(model, owner + ".classValue").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aMethodParameterShadowingTheClassParameterIsTheMethodsOwn(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = GM + "+GenericClassWithShadowedParameter`1";
        MethodNode shadowing = Models.method(model, owner + "#genericMethodWithTypeParameterShadowingClassParameter`1(!!0)");
        TypeRef.TypeParameterRef parameter = (TypeRef.TypeParameterRef) shadowing.signature().parameters().get(0).type();
        assertEquals("!!0", parameter.canonical());
        assertEquals(shadowing.id(), parameter.owner());
        assertEquals("T", shadowing.typeParameters().get(0).name());
        assertEquals("T", Models.type(model, owner).typeParameters().get(0).name());
        assertEquals("!0", Models.field(model, owner + ".classValue").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void staticGenericMethodsAreStaticWhereverTheyLive(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode identity = Models.method(model, GT + "GenericStaticClass`1#identity`1(!!0)");
        assertEquals(List.of(Modifier.STATIC), identity.modifiers());
        assertEquals("S", identity.typeParameters().get(0).name());
        assertEquals(List.of(Modifier.STATIC), Models.method(model, GM + "#staticGenericMethod`1(!!0)").modifiers());
        MethodNode listOf = Models.method(model, GM + "#listOf`1(!!0[])");
        assertEquals(List.of(Modifier.STATIC), listOf.modifiers());
        assertEquals("java.util.List`1[!!0]", listOf.signature().returnType().canonical());
        assertEquals(List.of(Modifier.STATIC), Models.method(model, GM + "+GenericMethodsInInterface#staticGenericMethodInInterface`1(!!0)").modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericOverridesAndInterfaceSlotsTargetTheGenericDefinition(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String overriding = "M:" + GM + "+GenericVirtualMethodsOverridden#virtualGenericMethod`1(!!0)";
        String overridden = "M:" + GM + "+GenericVirtualMethods#virtualGenericMethod`1(!!0)";
        assertEquals(List.of(overridden), Models.overridesOf(model, overriding));
        assertEquals(List.of("java.lang.CharSequence"), Models.constraintsOf(Models.method(model, overriding.substring(2)).typeParameters().get(0)));
        assertEquals(1, Models.invokesTo(model, overriding, overridden).size());
        assertEquals(List.of("M:" + GM + "+GenericVirtualMethods#abstractGenericMethod`1(!!0)"), Models.overridesOf(model, "M:" + GM + "+GenericVirtualMethodsOverridden#abstractGenericMethod`1(!!0)"));
        Edge.ImplementsMember slot = Models.one(Models.implementsMembersOf(model, "M:" + GM + "+GenericMethodsInInterfaceImplementation#method`1(!!0)"), e -> true, "generic slot");
        assertEquals("M:" + GM + "+GenericMethodsInInterface#method`1(!!0)", slot.to().value());
        assertEquals(GM + "+GenericMethodsInInterface", slot.interfaceType().canonical());
    }

    @Test
    void aSuperCallOfAGenericMethodCarriesTheOverridersOwnParameter() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        String overriding = "M:" + GM + "+GenericVirtualMethodsOverridden#virtualGenericMethod`1(!!0)";
        Edge.Invokes call = Models.invokesTo(model, overriding, "M:" + GM + "+GenericVirtualMethods#virtualGenericMethod`1(!!0)").get(0);
        assertEquals(List.of("!!0"), canonicals(call.typeArguments()));
        assertEquals(overriding, ((TypeRef.TypeParameterRef) call.typeArguments().get(0)).owner().value());
        assertEquals(ExpressionKind.BASE, call.receiver());
    }

    @Test
    void genericInvocationsCarryTheirInferredOrExplicitTypeArguments() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        List<Edge.Invokes> identity = Models.invokesTo(model, INVOCATIONS, "M:" + GM + "#identity`1(!!0)");
        assertEquals(2, identity.size());
        assertTrue(identity.stream().allMatch(e -> canonicals(e.typeArguments()).equals(List.of("java.lang.Integer"))), identity.toString());
        List<Edge.Invokes> two = Models.invokesTo(model, INVOCATIONS, "M:" + GM + "#genericMethodWithTwoParameters`2(!!0,java.util.function.Function`2[!!0,!!1])");
        assertEquals(2, two.size());
        assertTrue(two.stream().allMatch(e -> canonicals(e.typeArguments()).equals(List.of("java.lang.Integer", "java.lang.String"))), two.toString());
        assertEquals(List.of("java.lang.String"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + GM + "#genericMethodWithoutUsingParameterInSignature`1()").get(0).typeArguments()));
        assertEquals(List.of("java.lang.Integer"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + GM + "#staticGenericMethod`1(!!0)").get(0).typeArguments()));
        assertEquals(List.of("java.lang.Integer"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + GM + "#listOf`1(!!0[])").get(0).typeArguments()));
        assertEquals(List.of("java.lang.Integer"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + GT + "GenericStaticClass`1#identity`1(!!0)").get(0).typeArguments()));
        assertEquals(List.of("java.lang.Integer"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + GM + "+GenericMethodsInInterface#staticGenericMethodInInterface`1(!!0)").get(0).typeArguments()));
        List<Edge.Invokes> callers = Models.invokesTo(model, CALLERS, "M:" + GM + "#identity`1(!!0)");
        assertEquals(1, Models.count(callers, e -> canonicals(e.typeArguments()).equals(List.of("java.lang.String"))));
        assertEquals(1, Models.count(callers, e -> canonicals(e.typeArguments()).equals(List.of("java.lang.Integer"))));
        assertEquals(List.of("java.lang.String"), canonicals(Models.invokesTo(model, CALLERS, "M:" + GM + "#listOf`1(!!0[])").get(0).typeArguments()));
        assertEquals(List.of("java.lang.String", "java.lang.Integer"), canonicals(Models.invokesTo(model, CALLERS, "M:" + GM + "#maxValue`2(java.util.Map`2[!!0,!!1])").get(0).typeArguments()));
    }

    @Test
    void constructedTypesCarryTheirArgumentsOnTheConstructorCallOnly() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertEquals(List.of("java.lang.Integer"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + ONE + "#.ctor()").get(0).typeArguments()));
        assertEquals(List.of("java.lang.Integer", "java.lang.String"), canonicals(Models.invokesTo(model, INVOCATIONS, "M:" + ONE + "+NestedGenericClass`1#.ctor()").get(0).typeArguments()));
        assertEquals(List.of(), Models.invokesTo(model, INVOCATIONS, "M:java.util.Map`2#size()").get(0).typeArguments());
        assertEquals(List.of("java.util.List`1[!0]"), canonicals(Models.invokesTo(model, "M:" + ONE + "#nested()", "M:" + ONE + "#.ctor()").get(0).typeArguments()));
        assertEquals(List.of("!1", "!0"), canonicals(Models.invokesTo(model, "M:" + GT + "GenericClassWithTwoParameters`2#swapped()", "M:" + GT + "GenericClassWithTwoParameters`2#.ctor()").get(0).typeArguments()));
        assertEquals(List.of(ONE + "[java.lang.Integer]"), canonicals(Models.invokesTo(model, "F:" + GT + "ClosedGenericUsages.closedWithGeneric", "M:" + ONE + "#.ctor()").get(0).typeArguments()));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericInvocationsTargetTheDefinitionWhateverTheArguments(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Map<String, Integer> expected = Map.ofEntries(
                Map.entry("M:" + GM + "#.ctor()", 1),
                Map.entry("M:" + GM + "#identity`1(!!0)", 2),
                Map.entry("M:" + GM + "#genericMethodWithTwoParameters`2(!!0,java.util.function.Function`2[!!0,!!1])", 2),
                Map.entry("M:" + GM + "#genericMethodWithoutUsingParameterInSignature`1()", 1),
                Map.entry("M:" + GM + "#staticGenericMethod`1(!!0)", 1),
                Map.entry("M:" + GM + "#listOf`1(!!0[])", 1),
                Map.entry("M:" + GT + "GenericStaticClass`1#identity`1(!!0)", 1),
                Map.entry("M:" + GM + "+GenericMethodsInInterface#staticGenericMethodInInterface`1(!!0)", 1),
                Map.entry("M:" + ONE + "#.ctor()", 1),
                Map.entry("M:" + ONE + "+NestedGenericClass`1#.ctor()", 1));
        expected.forEach((target, calls) -> assertEquals(calls.intValue(), Models.invokesTo(model, INVOCATIONS, target).size(), target));
        Models.one(Models.invokes(model, INVOCATIONS), e -> e.to().value().equals("M:java.util.Map`2#size()"), "closedNested.map.size()");
        // every fixture target is one of the definitions above, never an erased id such as #identity(java.lang.Object)
        List<String> ownTargets = Models.invokes(model, INVOCATIONS).stream().map(e -> e.to().value()).filter(id -> id.startsWith("M:" + Models.SYNTAX)).distinct().sorted().toList();
        assertEquals(expected.keySet().stream().sorted().toList(), ownTargets);
        if (engine == EngineKind.BYTECODE) {
            assertTrue(Models.invokes(model, INVOCATIONS).stream().allMatch(e -> e.typeArguments().isEmpty()));
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void closedGenericUsagesSpellTheirArguments(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String usages = GT + "ClosedGenericUsages.";
        assertEquals(ONE + "[java.lang.Integer]", Models.field(model, usages + "closedWithValueType").type().canonical());
        assertEquals(ONE + "[java.lang.String]", Models.field(model, usages + "closedWithReferenceType").type().canonical());
        assertEquals(ONE + "[int[]]", Models.field(model, usages + "closedWithArray").type().canonical());
        assertEquals(ONE + "[" + ONE + "[java.lang.Integer]]", Models.field(model, usages + "closedWithGeneric").type().canonical());
        assertEquals(GT + "GenericClassWithTwoParameters`2[java.lang.Integer,java.lang.String]", Models.field(model, usages + "closedTwoParameters").type().canonical());
        assertEquals(GT + "GenericClassWithTwoParameters`2[java.util.List`1[java.lang.Integer],java.util.Map`2[java.lang.String,int[]]]", Models.field(model, usages + "closedTwoNested").type().canonical());
        assertEquals(ONE + "[java.lang.Object]", Models.field(model, usages + "closedWithObject").type().canonical());
        assertEquals(GT + "GenericDelegateWithTwoParameters`2[java.lang.Integer,java.lang.String]", Models.field(model, usages + "closedDelegate").type().canonical());
        FieldNode open = Models.field(model, usages + "openGenericTypeOf");
        assertEquals("java.lang.Class`1[<other:?>]", open.type().canonical());
        assertEquals(new TypeRef.Other("?"), ((TypeRef.Named) open.type()).typeArguments().get(0));
        assertEquals("java.lang.Class`1[<other:?>]", Models.field(model, usages + "openGenericTypeOfTwoParameters").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void classLiteralInitializersProduceNoEdge(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String usages = GT + "ClosedGenericUsages";
        if (engine == EngineKind.BYTECODE) {
            // bytecode puts field initializers into the constructor; lines 140-141 only store the fields
            String ctor = "M:" + usages + "#.ctor()";
            assertTrue(Models.invokes(model, ctor).stream().noneMatch(e -> e.site().location().startLine() == 140 || e.site().location().startLine() == 141));
            List<Edge.Accesses> stores = Models.accesses(model, ctor).stream().filter(e -> e.site().location().startLine() == 140 || e.site().location().startLine() == 141).toList();
            assertEquals(List.of("F:" + usages + ".openGenericTypeOf", "F:" + usages + ".openGenericTypeOfTwoParameters"), stores.stream().map(e -> e.to().value()).sorted().toList());
            assertTrue(stores.stream().allMatch(e -> e.access() == AccessKind.WRITE), stores.toString());
            assertTrue(Models.usesTypes(model, ctor).isEmpty());
        } else {
            for (String field : List.of("openGenericTypeOf", "openGenericTypeOfTwoParameters")) {
                String id = "F:" + usages + "." + field;
                assertTrue(model.edges().stream().noneMatch(e -> e.from().value().equals(id)), id);
            }
        }
    }

    @Test
    void innerClassesOfConstructedOutersCarryTheOuterArgumentsInSource() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        assertEquals(ONE + "+NestedClassSharingOuterParameter[java.lang.Integer]", Models.field(model, GT + "ClosedGenericUsages.closedNested").type().canonical());
        assertEquals(ONE + "+NestedGenericClass`1[java.lang.Integer,java.lang.String]", Models.field(model, GT + "ClosedGenericUsages.closedNestedGeneric").type().canonical());
        assertEquals(ONE + "+NestedClassSharingOuterParameter[java.lang.String]", Models.field(model, GT + "WildcardUses.innerOfConstructed").type().canonical());
        assertEquals(ONE + "+NestedGenericClass`1[java.lang.String,java.lang.Integer]", Models.field(model, GT + "WildcardUses.innerGenericOfConstructed").type().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void wildcardsAndRawTypesAreOtherReferencesOrUnbound(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        FieldNode contravariant = Models.field(model, GT + "WildcardUses.contravariant");
        assertEquals(new TypeRef.Other("? super java.lang.Integer"), ((TypeRef.Named) contravariant.type()).typeArguments().get(0));
        assertEquals("java.util.List`1[<other:? super java.lang.Integer>]", contravariant.type().canonical());
        assertEquals("java.util.List`1[<other:?>]", Models.field(model, GT + "WildcardUses.unbounded").type().canonical());
        assertEquals("java.util.Map`2[java.lang.String,java.util.List`1[java.lang.Integer]]", Models.field(model, GT + "WildcardUses.nested").type().canonical());
        assertEquals(ONE + "+StaticNestedGeneric`1[java.lang.Long]", Models.field(model, GT + "WildcardUses.staticNested").type().canonical());
        assertTrue(((TypeRef.Named) Models.field(model, GT + "WildcardUses.raw").type()).unbound());
        MethodNode sum = Models.method(model, GM + "#sum`1(java.util.List`1[<other:? extends !!0>])");
        assertEquals("java.util.List`1[<other:? extends !!0>]", sum.signature().parameters().get(0).type().canonical());
        assertEquals(List.of("java.lang.Number"), Models.constraintsOf(sum.typeParameters().get(0)));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void membersOfGenericTypesSpellConstructedTypesWithTheOwnersParameters(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(ONE + "[!0]", Models.method(model, ONE + "#self()").signature().returnType().canonical());
        assertEquals(ONE + "[java.util.List`1[!0]]", Models.method(model, ONE + "#nested()").signature().returnType().canonical());
        assertEquals("!0[]", Models.field(model, ONE + ".values").type().canonical());
        assertEquals("java.util.List`1[!0]", Models.field(model, ONE + ".list").type().canonical());
        assertEquals(GT + "GenericClassWithTwoParameters`2[!1,!0]", Models.method(model, GT + "GenericClassWithTwoParameters`2#swapped()").signature().returnType().canonical());
        assertEquals("java.util.Map`2[!0,!1]", Models.field(model, GT + "GenericClassWithTwoParameters`2.asMap").type().canonical());
        TypeNode record = Models.type(model, GT + "GenericRecordWithTwoParameters`2");
        assertEquals(List.of("F", "S"), record.typeParameters().stream().map(TypeParameter::name).toList());
        assertTrue(record.modifiers().contains(Modifier.RECORD));
        assertEquals("!1", Models.method(model, GT + "GenericRecordWithTwoParameters`2#second()").signature().returnType().canonical());
        TypeNode delegate = Models.type(model, GT + "GenericDelegateWithTwoParameters`2");
        assertEquals(TypeKind.INTERFACE, delegate.typeKind());
        assertEquals("!1", Models.method(model, GT + "GenericDelegateWithTwoParameters`2#invoke(!0)").signature().returnType().canonical());
        assertTrue(Models.type(model, GT + "GenericFinalClass`1").modifiers().contains(Modifier.FINAL));
        assertTrue(Models.type(model, GT + "GenericAbstractClass`1").modifiers().contains(Modifier.ABSTRACT));
        assertTrue(Models.method(model, GT + "GenericAbstractClass`1#create()").bodiless());
    }

    private static List<String> canonicals(List<TypeRef> types) {
        return types.stream().map(TypeRef::canonical).collect(Collectors.toList());
    }
}
