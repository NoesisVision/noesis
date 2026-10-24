package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.AccessKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.StubKind;
import vision.noesis.parser.model.StubNode;
import vision.noesis.parser.model.TypeKind;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeParameterConstraint;
import vision.noesis.parser.model.TypeRef;

/** Class inheritance as the .NET parser's InheritanceTests pin it: bases, overrides, constructor chains, hiding, generic bases. */
class InheritanceFactsTest {

    private static final String CI = Models.SYNTAX + "inheritance.ClassInheritance+";
    private static final String AI = Models.SYNTAX + "inheritance.AbstractInheritance+";
    private static final String GI = Models.SYNTAX + "inheritance.GenericInheritance+";
    private static final String OTHER_ABSTRACT = Models.OTHER + "OtherAbstractClass";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aDeclaredBaseClassIsAnExtendsEdgeHoweverItIsSpelt(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(CI + "Base"), Models.extendsOf(model, "T:" + CI + "Derived"));
        assertEquals(List.of(CI + "Base"), Models.extendsOf(model, "T:" + CI + "DerivedFromFullyQualifiedName"));
        assertEquals(List.of(Models.SYNTAX + "types.ClassKinds+PlainClass"), Models.extendsOf(model, "T:" + CI + "DerivedFromNestedClass"));
        assertEquals(List.of(CI + "SecondLevelDerivedClass"), Models.extendsOf(model, "T:" + CI + "ThirdLevelDerivedClass"));
        assertEquals(List.of(CI + "OuterClassWithNestedDerivingFromOuter"), Models.extendsOf(model, "T:" + CI + "OuterClassWithNestedDerivingFromOuter+NestedDerivedFromOuter"));
        assertEquals(List.of(), Models.implementsOf(model, "T:" + CI + "Derived"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void frameworkBasesAreConstructedStubsWithTheirArtifact(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("java.util.AbstractList`1[java.lang.Integer]"), Models.extendsOf(model, "T:" + CI + "DerivedFromFrameworkType"));
        assertEquals(List.of("java.util.ArrayList`1[java.lang.Integer]"), Models.extendsOf(model, "T:" + CI + "DerivedFromFrameworkCollection"));
        assertEquals(List.of("java.lang.Exception"), Models.extendsOf(model, "T:" + CI + "DerivedFromException"));
        assertEquals(List.of(), Models.implementsOf(model, "T:" + CI + "DerivedFromException"));
        for (String id : List.of("T:java.lang.Exception", "T:java.util.AbstractList`1", "T:java.util.ArrayList`1")) {
            StubNode stub = Models.stub(model, id);
            assertEquals(StubKind.TYPE, stub.kind(), id);
            assertEquals(TypeKind.CLASS, stub.typeKind(), id);
            assertEquals("A:java.base@17", stub.artifact().value(), id);
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void otherModuleBasesAreNodesOfTheirOwnModelNotStubs(EngineKind engine) {
        assertEquals(List.of(OTHER_ABSTRACT), Models.extendsOf(Models.syntax(engine), "T:" + CI + "DerivedFromOtherProjectClass"));
        assertFalse(Models.hasStub(Models.syntax(engine), "T:" + OTHER_ABSTRACT));
        assertTrue(Models.type(Models.other(engine), OTHER_ABSTRACT).modifiers().contains(Modifier.ABSTRACT));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void overridesAreOneHopToTheDefinition(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("M:" + CI + "Base#overridable()"), Models.overridesOf(model, "M:" + CI + "Derived#overridable()"));
        assertEquals(List.of("M:" + CI + "Derived#overridable()"), Models.overridesOf(model, "M:" + CI + "SecondLevelDerivedClass#overridable()"));
        // AbstractIntermediate does not redeclare these, so the override skips it and names the definition two levels up.
        assertEquals(List.of("M:" + AI + "AbstractBaseWithAllMemberKinds#protectedAbstractMethod()"), Models.overridesOf(model, "M:" + AI + "ConcreteFromAbstractIntermediate#protectedAbstractMethod()"));
        assertEquals(List.of("M:" + AI + "AbstractBaseWithAllMemberKinds#abstractGenericMethod`1(!!0)"), Models.overridesOf(model, "M:" + AI + "ConcreteFromAbstractIntermediate#abstractGenericMethod`1(!!0)"));
        // A static method hides the base one; it overrides nothing.
        Models.method(model, CI + "Base#staticMethod()");
        assertEquals(List.of(), Models.overridesOf(model, "M:" + CI + "HidingSubclass#staticMethod()"));
        assertEquals(List.of("M:" + CI + "Base#covariant()"), Models.overridesOf(model, "M:" + CI + "Derived#covariant()"));
        assertEquals("java.lang.String", Models.method(model, CI + "Derived#covariant()").signature().returnType().canonical());
        assertEquals(List.of("M:" + CI + "Base#virtualGenericMethod`1(!!0)"), Models.overridesOf(model, "M:" + CI + "Derived#virtualGenericMethod`1(!!0)"));
        assertEquals(List.of("M:" + CI + "Base#packagePrivateMethod()"), Models.overridesOf(model, "M:" + CI + "Derived#packagePrivateMethod()"));
        assertEquals(List.of("M:" + OTHER_ABSTRACT + "#abstractMethodFromOtherModule()"), Models.overridesOf(model, "M:" + CI + "DerivedFromOtherProjectClass#abstractMethodFromOtherModule()"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void objectMethodsOverrideTheStubOnTheFirstDeclarerOnly(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("M:java.lang.Object#toString()"), Models.overridesOf(model, "M:" + CI + "Base#toString()"));
        assertEquals(List.of("M:" + CI + "Base#toString()"), Models.overridesOf(model, "M:" + CI + "Derived#toString()"));
        StubNode toString = Models.stub(model, "M:java.lang.Object#toString()");
        assertEquals(StubKind.METHOD, toString.kind());
        assertEquals("A:java.base@17", toString.artifact().value());
        assertEquals(List.of("M:java.lang.Object#finalize()"), Models.overridesOf(model, "M:" + CI + "DerivedClassWithFinalizer#finalize()"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void overrideModifiersSayWhetherTheMemberStaysOverridable(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(Modifier.VIRTUAL), Models.method(model, CI + "Base#overridable()").modifiers());
        assertEquals(List.of(Modifier.FINAL), Models.method(model, CI + "SecondLevelDerivedClass#overridable()").modifiers());
        assertEquals(List.of(Modifier.FINAL), Models.method(model, CI + "Base#finalMethod()").modifiers());
        MethodNode reAbstracted = Models.method(model, AI + "AbstractIntermediate#virtualMethodWithDefaultBody()");
        assertEquals(List.of(Modifier.ABSTRACT), reAbstracted.modifiers());
        assertTrue(reAbstracted.bodiless());
        assertEquals(List.of("M:" + AI + "AbstractBaseWithAllMemberKinds#virtualMethodWithDefaultBody()"), Models.overridesOf(model, reAbstracted.id().value()));
        assertEquals(List.of("M:" + AI + "AbstractIntermediate#virtualMethodWithDefaultBody()"), Models.overridesOf(model, "M:" + AI + "ConcreteFromAbstractIntermediate#virtualMethodWithDefaultBody()"));
        assertEquals(List.of(Modifier.STATIC, Modifier.FINAL), Models.type(model, CI + "SealedDerivedClass").modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void constructorChainingIsAnInvokesOfTheBaseConstructor(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(1, Models.invokesTo(model, "M:" + AI + "ConcreteCallingAbstractConstructor#.ctor()", "M:" + AI + "AbstractClassWithConstructor#.ctor(int)").size());
        assertEquals(1, Models.invokesTo(model, "M:" + CI + "DerivedFromException#.ctor()", "M:java.lang.Exception#.ctor()").size());
        assertEquals(1, Models.invokesTo(model, "M:" + CI + "DerivedFromException#.ctor(java.lang.String)", "M:java.lang.Exception#.ctor(java.lang.String)").size());
        assertEquals(1, Models.invokesTo(model, "M:" + CI + "DerivedFromException#.ctor(java.lang.String,java.lang.Exception)", "M:java.lang.Exception#.ctor(java.lang.String,java.lang.Throwable)").size());
        assertEquals(1, Models.invokesTo(model, "M:" + CI + "DerivedFromOtherProjectClass#.ctor()", "M:" + OTHER_ABSTRACT + "#.ctor(int)").size());
        assertEquals(1, Models.invokesTo(model, "M:" + CI + "DerivedViaProtectedConstructor#.ctor()", "M:" + CI + "BaseClassWithProtectedConstructorOnly#.ctor()").size());
        assertEquals(ExpressionKind.BASE, Models.invokesTo(model, "M:" + CI + "DerivedFromOtherProjectClass#.ctor()", "M:" + OTHER_ABSTRACT + "#.ctor(int)").get(0).receiver());
    }

    @ParameterizedTest
    @EnumSource(names = {"SOURCE", "HYBRID"})
    void implicitConstructorsAndSuperCallsAreSourceFacts(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(Origin.GENERATED, Models.method(model, CI + "DerivedViaProtectedConstructor#.ctor()").origin());
        assertEquals(Origin.DECLARED, Models.method(model, CI + "DerivedFromException#.ctor()").origin());
        Edge.Invokes implicit = Models.invokesTo(model, "M:" + CI + "DerivedViaProtectedConstructor#.ctor()", "M:" + CI + "BaseClassWithProtectedConstructorOnly#.ctor()").get(0);
        assertEquals(true, implicit.site().languageSpecific().get("java.implicitSuperCall"));
        assertEquals(ExpressionKind.BASE, implicit.receiver());
        Edge.Invokes explicit = Models.invokesTo(model, "M:" + AI + "ConcreteCallingAbstractConstructor#.ctor()", "M:" + AI + "AbstractClassWithConstructor#.ctor(int)").get(0);
        assertNull(explicit.site().languageSpecific().get("java.implicitSuperCall"));
        assertEquals(ExpressionKind.BASE, explicit.receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aSuperCallInsideALambdaBelongsToTheMemberViaClosure(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Edge.Invokes call = Models.one(Models.invokesTo(model, "M:" + CI + "DerivedCallingBaseInsideLambda#compute()", "M:" + CI + "BaseClassCalledFromDerivedWithBaseKeyword#compute()"), e -> true, "super.compute() call");
        assertTrue(call.site().viaClosure());
        assertEquals(List.of("M:" + CI + "BaseClassCalledFromDerivedWithBaseKeyword#compute()"), Models.overridesOf(model, "M:" + CI + "DerivedCallingBaseInsideLambda#compute()"));
    }

    @ParameterizedTest
    @EnumSource(names = {"SOURCE", "HYBRID"})
    void superCallsHaveABaseReceiverInsideALambdaAndOutside(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(ExpressionKind.BASE, Models.invokesTo(model, "M:" + CI + "DerivedCallingBaseInsideLambda#compute()", "M:" + CI + "BaseClassCalledFromDerivedWithBaseKeyword#compute()").get(0).receiver());
        assertEquals(ExpressionKind.BASE, Models.invokesTo(model, "M:" + CI + "Derived#overridable()", "M:" + CI + "Base#overridable()").get(0).receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void inheritedStaticsAreUsedOnTheDeclaringType(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Edge.Accesses read = Models.one(Models.accesses(model, "M:" + CI + "DerivedClassUsingInheritedStatics#readInheritedStaticField()"), e -> true, "static field read");
        assertEquals("F:" + CI + "BaseClassWithStaticMembers.staticFieldOnBase", read.to().value());
        assertEquals(AccessKind.READ, read.access());
        assertEquals(ExpressionKind.TYPE, read.receiver());
        Edge.Invokes call = Models.one(Models.invokes(model, "M:" + CI + "DerivedClassUsingInheritedStatics#callInheritedStaticMethod()"), e -> true, "static method call");
        assertEquals("M:" + CI + "BaseClassWithStaticMembers#staticMethodOnBase()", call.to().value());
        assertEquals(ExpressionKind.TYPE, call.receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aHidingFieldIsItsOwnNodeAndBothFieldsAreRead(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals("int", Models.field(model, CI + "DerivedClassHidingField.baseField").type().canonical());
        assertEquals("int", Models.field(model, CI + "Base.baseField").type().canonical());
        List<Edge.Accesses> reads = Models.accesses(model, "M:" + CI + "DerivedClassHidingField#readHidingField()");
        assertEquals(2, reads.size());
        assertEquals(1, Models.count(reads, e -> e.to().value().equals("F:" + CI + "DerivedClassHidingField.baseField") && e.access() == AccessKind.READ));
        assertEquals(1, Models.count(reads, e -> e.to().value().equals("F:" + CI + "Base.baseField") && e.access() == AccessKind.READ));
    }

    @ParameterizedTest
    @EnumSource(names = {"SOURCE", "HYBRID"})
    void aHiddenFieldIsReadThroughSuperAndTheHidingOneThroughThis(EngineKind engine) {
        List<Edge.Accesses> reads = Models.accesses(Models.syntax(engine), "M:" + CI + "DerivedClassHidingField#readHidingField()");
        assertEquals(ExpressionKind.THIS, Models.one(reads, e -> e.to().value().endsWith("DerivedClassHidingField.baseField"), "hiding read").receiver());
        assertEquals(ExpressionKind.BASE, Models.one(reads, e -> e.to().value().endsWith("Base.baseField"), "hidden read").receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void sameNamedNestedTypesLiveUnderEachOwner(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals("NestedTypeToHide", Models.type(model, CI + "Base+NestedTypeToHide").name());
        assertEquals("NestedTypeToHide", Models.type(model, CI + "Derived+NestedTypeToHide").name());
        assertTrue(Models.contains(model, "T:" + CI + "Base", "T:" + CI + "Base+NestedTypeToHide"));
        assertTrue(Models.contains(model, "T:" + CI + "Derived", "T:" + CI + "Derived+NestedTypeToHide"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aSelfReferencingBoundNamesTheOwnerWithItsOwnParameter(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        TypeNode base = Models.type(model, CI + "SelfReferencingGenericBase`1");
        assertEquals("S", base.typeParameters().get(0).name());
        assertEquals(List.of(CI + "SelfReferencingGenericBase`1[!0]"), Models.constraintsOf(base.typeParameters().get(0)));
        TypeRef bound = ((TypeParameterConstraint.TypeConstraint) base.typeParameters().get(0).constraints().get(0)).type();
        assertEquals(base.id(), ((TypeRef.TypeParameterRef) ((TypeRef.Named) bound).typeArguments().get(0)).owner());
        assertEquals(List.of(CI + "SelfReferencingGenericBase`1[" + CI + "DerivedFromSelfReferencingGeneric]"), Models.extendsOf(model, "T:" + CI + "DerivedFromSelfReferencingGeneric"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericBasesKeepTheirArguments(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(GI + "GenericBaseClass`1[java.lang.Integer]"), Models.extendsOf(model, "T:" + GI + "DerivedFromClosedGenericBase"));
        assertEquals(List.of(GI + "GenericBaseClass`1[!0]"), Models.extendsOf(model, "T:" + GI + "DerivedFromOpenGenericBase`1"));
        TypeRef.Named open = (TypeRef.Named) Models.edgesFrom(model, Edge.Extends.class, "T:" + GI + "DerivedFromOpenGenericBase`1").get(0).to();
        TypeRef.TypeParameterRef argument = (TypeRef.TypeParameterRef) open.typeArguments().get(0);
        assertEquals("T:" + GI + "DerivedFromOpenGenericBase`1", argument.owner().value());
        assertEquals(0, argument.ordinal());
        assertEquals(List.of(GI + "GenericBaseClass`1[!0]"), Models.extendsOf(model, "T:" + GI + "DerivedFromOpenGenericBaseWithRenamedParameter`1"));
        assertEquals("R", Models.type(model, GI + "DerivedFromOpenGenericBaseWithRenamedParameter`1").typeParameters().get(0).name());
        assertEquals(List.of(GI + "GenericBaseClass`1[!0]"), Models.extendsOf(model, "T:" + GI + "DerivedFromGenericBaseWithConstraint`1"));
        assertEquals(List.of("java.lang.Number"), Models.constraintsOf(Models.type(model, GI + "DerivedFromGenericBaseWithConstraint`1").typeParameters().get(0)));
        assertEquals(List.of(GI + "GenericBaseClass`1[!0]"), Models.extendsOf(model, "T:" + GI + "DerivedFromGenericBaseWithExtraParameter`2"));
        assertEquals("!1", Models.field(model, GI + "DerivedFromGenericBaseWithExtraParameter`2.secondValue").type().canonical());
        assertEquals(List.of(GI + "GenericBaseClass`1[java.util.List`1[java.util.Map`2[java.lang.String,int[]]]]"), Models.extendsOf(model, "T:" + GI + "DerivedFromNestedClosedGenericBase"));
        assertEquals(List.of(GI + "GenericBaseClass`1[java.lang.String[]]"), Models.extendsOf(model, "T:" + GI + "DerivedFromGenericBaseWithArrayArgument"));
        assertEquals(List.of(GI + "GenericBaseClass`1[" + Models.OTHER + "OtherClass]"), Models.extendsOf(model, "T:" + GI + "DerivedFromGenericBaseOfOtherProjectType"));
        assertEquals(List.of("java.util.ArrayList`1[java.lang.Integer]"), Models.extendsOf(model, "T:" + GI + "DerivedFromFrameworkGenericClass"));
        assertEquals(List.of("java.util.HashMap`2[java.lang.String,!0]"), Models.extendsOf(model, "T:" + GI + "DerivedFromFrameworkGenericClassWithOwnParameter`1"));
        // canonical() drops the owner of !0; each one is the deriving type.
        for (String derived : List.of("DerivedFromOpenGenericBaseWithRenamedParameter`1", "DerivedFromGenericBaseWithConstraint`1", "DerivedFromGenericBaseWithExtraParameter`2", "DerivedFromFrameworkGenericClassWithOwnParameter`1")) {
            TypeRef.Named base = (TypeRef.Named) Models.edgesFrom(model, Edge.Extends.class, "T:" + GI + derived).get(0).to();
            TypeRef.TypeParameterRef last = (TypeRef.TypeParameterRef) base.typeArguments().get(base.typeArguments().size() - 1);
            assertEquals("T:" + GI + derived, last.owner().value(), derived);
            assertEquals(0, last.ordinal(), derived);
        }
        TypeRef.TypeParameterRef second = (TypeRef.TypeParameterRef) Models.field(model, GI + "DerivedFromGenericBaseWithExtraParameter`2.secondValue").type();
        assertEquals("T:" + GI + "DerivedFromGenericBaseWithExtraParameter`2", second.owner().value());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void overridesOfGenericBaseMembersTargetTheOpenDefinition(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of("M:" + GI + "GenericBaseClass`1#genericVirtualMethod(!0)"), Models.overridesOf(model, "M:" + GI + "DerivedFromClosedGenericBase#genericVirtualMethod(java.lang.Integer)"));
        assertEquals(List.of("M:" + GI + "GenericBaseClass`1#genericVirtualMethod(!0)"), Models.overridesOf(model, "M:" + GI + "DerivedFromOpenGenericBase`1#genericVirtualMethod(!0)"));
        assertEquals(List.of("M:" + GI + "GenericAbstractBase`1#create()"), Models.overridesOf(model, "M:" + GI + "ConcreteFromGenericAbstract#create()"));
        assertEquals(List.of(Models.OTHER + "OtherGeneric`1[java.lang.String]"), Models.extendsOf(model, "T:" + GI + "DerivedFromOtherProjectGenericClass"));
        assertEquals(List.of("M:" + Models.OTHER + "OtherGeneric`1#item()"), Models.overridesOf(model, "M:" + GI + "DerivedFromOtherProjectGenericClass#item()"));
        assertEquals(1, Models.invokesTo(model, "M:" + GI + "DerivedFromOtherProjectGenericClass#item()", "M:" + Models.OTHER + "OtherGeneric`1#item()").size());
        assertEquals(List.of("com.google.common.base.Converter`2[java.lang.String,java.lang.Integer]"), Models.extendsOf(model, "T:" + GI + "LengthConverter"));
        assertEquals(List.of("M:com.google.common.base.Converter`2#doForward(!0)"), Models.overridesOf(model, "M:" + GI + "LengthConverter#doForward(java.lang.String)"));
        assertEquals(List.of("M:com.google.common.base.Converter`2#doBackward(!1)"), Models.overridesOf(model, "M:" + GI + "LengthConverter#doBackward(java.lang.Integer)"));
        assertTrue(Models.stub(model, "T:com.google.common.base.Converter`2").artifact().value().startsWith("A:com.google.guava:guava@"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void inheritedMembersFillTheInterfaceSlotsOfALibraryBase(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        // Converter<A, B> implements both Function interfaces; LengthConverter declares neither apply nor equals.
        List<Edge.ImplementsMember> slots = Models.implementsMembersDeclaredOn(model, "T:" + GI + "LengthConverter");
        assertEquals(List.of(
                "M:com.google.common.base.Converter`2#apply(!0) -> M:com.google.common.base.Function`2#apply(!0)",
                "M:com.google.common.base.Converter`2#apply(!0) -> M:java.util.function.Function`2#apply(!0)",
                "M:com.google.common.base.Converter`2#equals(java.lang.Object) -> M:com.google.common.base.Function`2#equals(java.lang.Object)"),
                slots.stream().map(e -> e.from().value() + " -> " + e.to().value()).toList());
        assertEquals(List.of(
                "com.google.common.base.Function`2[java.lang.String,java.lang.Integer]",
                "java.util.function.Function`2[java.lang.String,java.lang.Integer]",
                "com.google.common.base.Function`2[java.lang.String,java.lang.Integer]"),
                slots.stream().map(e -> e.interfaceType().canonical()).toList());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void nestedClassesDerivingFromTheGenericOuterNameTheOutersParameter(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String inner = GI + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromGenericOuter";
        assertEquals(List.of(GI + "GenericClassWithNestedDerivedClass`1[!0]"), Models.extendsOf(model, "T:" + inner));
        TypeRef.Named base = (TypeRef.Named) Models.edgesFrom(model, Edge.Extends.class, "T:" + inner).get(0).to();
        assertEquals("T:" + GI + "GenericClassWithNestedDerivedClass`1", ((TypeRef.TypeParameterRef) base.typeArguments().get(0)).owner().value());
        assertEquals(List.of(), Models.type(model, inner).typeParameters());
        assertEquals(List.of(), Models.type(model, inner).modifiers());
        String nested = GI + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromClosedGenericOuter";
        assertEquals(List.of(GI + "GenericClassWithNestedDerivedClass`1[java.lang.Integer]"), Models.extendsOf(model, "T:" + nested));
        assertEquals(List.of(Modifier.STATIC), Models.type(model, nested).modifiers());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void frameworkBaseMembersAreOverridesAndInterfaceSlotsAtOnce(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String get = "M:" + CI + "DerivedFromFrameworkType#get(int)";
        assertEquals(List.of("M:java.util.AbstractList`1#get(int)"), Models.overridesOf(model, get));
        Edge.ImplementsMember slot = Models.one(Models.implementsMembersOf(model, get), e -> true, "List.get slot");
        assertEquals("M:java.util.List`1#get(int)", slot.to().value());
        assertEquals("java.util.List`1[java.lang.Integer]", slot.interfaceType().canonical());
        assertEquals("T:" + CI + "DerivedFromFrameworkType", slot.declaredOn().value());
        String size = "M:" + CI + "DerivedFromFrameworkType#size()";
        assertEquals(List.of("M:java.util.AbstractCollection`1#size()"), Models.overridesOf(model, size));
        List<Edge.ImplementsMember> sizeSlots = Models.implementsMembersOf(model, size);
        assertEquals(List.of("M:java.util.Collection`1#size()", "M:java.util.List`1#size()"), sizeSlots.stream().map(e -> e.to().value()).toList());
        assertEquals(List.of(), Models.implementsOf(model, "T:" + CI + "DerivedFromFrameworkType"));
    }
}
