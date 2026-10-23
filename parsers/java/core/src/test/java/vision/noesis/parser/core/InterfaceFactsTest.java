package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.ExpressionKind;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.StubKind;
import vision.noesis.parser.model.StubNode;
import vision.noesis.parser.model.TypeKind;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.Visibility;

/** Interfaces as the .NET parser's InterfaceTests pin them: inheritance is EXTENDS, implementation is IMPLEMENTS, slots are IMPLEMENTS_MEMBER. */
class InterfaceFactsTest {

    private static final String II = Models.SYNTAX + "inheritance.InterfaceInheritance+";
    private static final String IMPL = Models.SYNTAX + "interfaces.InterfaceImplementation+";
    private static final String KINDS = Models.SYNTAX + "types.InterfaceKinds+";
    private static final String GENERIC_INTERFACE = KINDS + "GenericInterface`1";
    private static final String PLAIN_INTERFACE = KINDS + "PlainInterface";
    private static final String TWO = Models.SYNTAX + "generics.GenericTypes+GenericInterfaceWithTwoParameters`2";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void interfaceInheritanceIsExtendsAndNeverImplements(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(II + "BaseInterface", II + "SecondBaseInterface"), Models.extendsOf(model, "T:" + II + "DerivedFromTwoInterfaces"));
        assertEquals(List.of(II + "DerivedFromTwoInterfaces", II + "DerivedInterface"), Models.extendsOf(model, "T:" + II + "ThirdLevelInterface"));
        assertEquals(List.of(GENERIC_INTERFACE + "[!0]"), Models.extendsOf(model, "T:" + II + "GenericDerivedInterface`1"));
        TypeRef.Named generic = (TypeRef.Named) Models.edgesFrom(model, Edge.Extends.class, "T:" + II + "GenericDerivedInterface`1").get(0).to();
        assertEquals("T:" + II + "GenericDerivedInterface`1", ((TypeRef.TypeParameterRef) generic.typeArguments().get(0)).owner().value());
        assertEquals(List.of("java.lang.Number"), Models.constraintsOf(Models.type(model, II + "GenericDerivedInterface`1").typeParameters().get(0)));
        assertEquals(List.of(GENERIC_INTERFACE + "[java.lang.Integer]"), Models.extendsOf(model, "T:" + II + "DerivedFromClosedGenericInterface"));
        assertEquals(List.of("java.lang.AutoCloseable", "java.lang.Comparable`1[" + II + "DerivedFromFrameworkInterfaces]"), Models.extendsOf(model, "T:" + II + "DerivedFromFrameworkInterfaces"));
        for (String name : List.of("DerivedFromTwoInterfaces", "ThirdLevelInterface", "GenericDerivedInterface`1", "DerivedFromClosedGenericInterface", "DerivedFromFrameworkInterfaces")) {
            assertEquals(TypeKind.INTERFACE, Models.type(model, II + name).typeKind());
            assertEquals(List.of(), Models.implementsOf(model, "T:" + II + name), name);
        }
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void anInterfaceReAbstractingADefaultFillsTheInheritedSlotsItself(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode first = Models.method(model, II + "DerivedInterfaceHidingMember#first()");
        assertEquals(List.of(Modifier.ABSTRACT), first.modifiers());
        assertTrue(first.bodiless());
        assertEquals(List.of(), Models.overridesOf(model, first.id().value()));
        List<Edge.ImplementsMember> slots = Models.implementsMembersOf(model, first.id().value());
        assertEquals(List.of("M:" + II + "First#first()", "M:" + II + "Second#first()"), slots.stream().map(e -> e.to().value()).toList());
        assertTrue(slots.stream().allMatch(e -> e.declaredOn().value().equals("T:" + II + "DerivedInterfaceHidingMember")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void implementsCanonicalsHoweverTheInterfaceIsSpelt(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(List.of(II + "First", II + "SecondBaseInterface", GENERIC_INTERFACE + "[java.lang.String]", PLAIN_INTERFACE),
                Models.implementsOf(model, "T:" + IMPL + "MultipleInterfacesImplementation"));
        assertEquals(List.of(PLAIN_INTERFACE), Models.implementsOf(model, "T:" + IMPL + "ImplementationViaFullyQualifiedInterfaceName"));
        assertEquals(List.of(Models.OTHER + "OtherPlainInterface"), Models.implementsOf(model, "T:" + IMPL + "OtherProjectInterfaceImplementation"));
        assertEquals(List.of(Models.OTHER + "OtherInterface`1[java.lang.String]"), Models.implementsOf(model, "T:" + IMPL + "OtherProjectGenericInterfaceImplementation"));
        assertFalse(Models.hasStub(model, "T:" + Models.OTHER + "OtherInterface`1"));
        assertEquals(TypeKind.INTERFACE, Models.type(Models.other(engine), Models.OTHER + "OtherPlainInterface").typeKind());
        Edge.ImplementsMember other = Models.one(Models.implementsMembersOf(model, "M:" + IMPL + "OtherProjectGenericInterfaceImplementation#put(java.lang.String)"), e -> true, "put slot");
        assertEquals("M:" + Models.OTHER + "OtherInterface`1#put(!0)", other.to().value());
        assertEquals(Models.OTHER + "OtherInterface`1[java.lang.String]", other.interfaceType().canonical());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void implicitImplementationMapsEveryAbstractSlotAndNoDefault(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = IMPL + "ImplicitImplementation";
        String iface = IMPL + "InterfaceWithAllMemberKinds";
        List<Edge.ImplementsMember> slots = Models.implementsMembersDeclaredOn(model, "T:" + owner);
        assertEquals(Map.of(
                "M:" + owner + "#method()", "M:" + iface + "#method()",
                "M:" + owner + "#getOnlyProperty()", "M:" + iface + "#getOnlyProperty()",
                "M:" + owner + "#genericMethod`1(!!0)", "M:" + iface + "#genericMethod`1(!!0)"),
                slots.stream().collect(Collectors.toMap(e -> e.from().value(), e -> e.to().value())));
        assertTrue(slots.stream().allMatch(e -> e.interfaceType().canonical().equals(iface)));
        assertFalse(Models.method(model, iface + "#defaultMethod()").bodiless());
        assertEquals(List.of(Modifier.STATIC), Models.method(model, iface + "#staticMethod()").modifiers());
        assertTrue(Models.edges(model, Edge.ImplementsMember.class).noneMatch(e -> e.to().value().endsWith("InterfaceWithAllMemberKinds#defaultMethod()")));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void anOverrideInADerivedClassTakesOverTheSlot(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Edge.ImplementsMember slot = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + IMPL + "OverriddenInterfaceImplementation"), e -> true, "overridden slot");
        assertEquals("M:" + IMPL + "OverriddenInterfaceImplementation#abstractMethod()", slot.from().value());
        assertEquals("M:" + PLAIN_INTERFACE + "#abstractMethod()", slot.to().value());
        assertEquals(List.of("M:" + IMPL + "VirtualImplementation#abstractMethod()"), Models.overridesOf(model, slot.from().value()));
        assertEquals(List.of(), Models.implementsOf(model, "T:" + IMPL + "OverriddenInterfaceImplementation"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void abstractRedeclarationsAndOmissionsFillTheSlotWhereTheMemberIs(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Edge.ImplementsMember redeclared = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + IMPL + "AbstractImplementation"), e -> true, "abstract slot");
        assertEquals("M:" + IMPL + "AbstractImplementation#abstractMethod()", redeclared.from().value());
        assertTrue(Models.method(model, IMPL + "AbstractImplementation#abstractMethod()").bodiless());
        Edge.ImplementsMember concrete = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + IMPL + "ConcreteFromAbstractImplementation"), e -> true, "concrete slot");
        assertEquals("M:" + IMPL + "ConcreteFromAbstractImplementation#abstractMethod()", concrete.from().value());
        assertEquals(List.of("M:" + IMPL + "AbstractImplementation#abstractMethod()"), Models.overridesOf(model, concrete.from().value()));
        assertEquals(List.of(), Models.implementsMembersDeclaredOn(model, "T:" + IMPL + "AbstractImplementationOmittingMember"));
        Edge.ImplementsMember omitted = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + IMPL + "ConcreteFromAbstractImplementationOmittingMember"), e -> true, "late slot");
        assertEquals("M:" + IMPL + "ConcreteFromAbstractImplementationOmittingMember#abstractMethod()", omitted.from().value());
        assertEquals("M:" + PLAIN_INTERFACE + "#abstractMethod()", omitted.to().value());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void reImplementationInADerivedClassMapsInheritedAndOwnMembers(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = IMPL + "ReImplementationInDerivedClass";
        List<Edge.ImplementsMember> slots = Models.implementsMembersDeclaredOn(model, "T:" + owner);
        assertEquals(3, slots.size());
        assertEquals("M:" + owner + "#method()", Models.one(slots, e -> e.to().value().endsWith("#method()"), "own method").from().value());
        assertEquals("M:" + IMPL + "ImplicitImplementation#getOnlyProperty()", Models.one(slots, e -> e.to().value().endsWith("#getOnlyProperty()"), "inherited getter").from().value());
        assertEquals("M:" + IMPL + "ImplicitImplementation#genericMethod`1(!!0)", Models.one(slots, e -> e.to().value().endsWith("#genericMethod`1(!!0)"), "inherited generic").from().value());
        assertEquals(List.of("M:" + IMPL + "ImplicitImplementation#method()"), Models.overridesOf(model, "M:" + owner + "#method()"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void oneMemberCanFillTheSlotsOfTwoInterfaces(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<Edge.ImplementsMember> shared = Models.implementsMembersOf(model, "M:" + IMPL + "ConflictResolvedWithSharedImplementation#conflictingName()");
        assertEquals(List.of("M:" + IMPL + "FirstConflictingInterface#conflictingName()", "M:" + IMPL + "SecondConflictingInterface#conflictingName()"), shared.stream().map(e -> e.to().value()).toList());
        assertEquals(List.of(IMPL + "FirstConflictingInterface", IMPL + "SecondConflictingInterface"), shared.stream().map(e -> e.interfaceType().canonical()).toList());
        String resolver = "M:" + IMPL + "ConflictingDefaultsResolvedByOverride#conflictingDefault()";
        assertEquals(List.of("M:" + IMPL + "FirstDefaultInterface#conflictingDefault()", "M:" + IMPL + "SecondDefaultInterface#conflictingDefault()"),
                Models.implementsMembersOf(model, resolver).stream().map(e -> e.to().value()).toList());
        assertEquals(1, Models.invokesTo(model, resolver, "M:" + IMPL + "FirstDefaultInterface#conflictingDefault()").size());
        assertEquals(1, Models.invokesTo(model, resolver, "M:" + IMPL + "SecondDefaultInterface#conflictingDefault()").size());
    }

    @ParameterizedTest
    @EnumSource(names = {"SOURCE", "HYBRID"})
    void interfaceSuperCallsHaveABaseReceiver(EngineKind engine) {
        String resolver = "M:" + IMPL + "ConflictingDefaultsResolvedByOverride#conflictingDefault()";
        List<Edge.Invokes> calls = Models.invokes(Models.syntax(engine), resolver);
        assertEquals(2, calls.size());
        assertTrue(calls.stream().allMatch(e -> e.receiver() == ExpressionKind.BASE), calls.toString());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void genericImplementationsCarryTheConstructedInterface(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        Edge.ImplementsMember open = Models.one(Models.implementsMembersOf(model, "M:" + IMPL + "TwoParameterGenericInterfaceImplementation`2#map(!0)"), e -> true, "open map");
        assertEquals("M:" + TWO + "#map(!0)", open.to().value());
        assertEquals(TWO + "[!0,!1]", open.interfaceType().canonical());
        List<TypeRef> openArguments = ((TypeRef.Named) open.interfaceType()).typeArguments();
        for (int ordinal = 0; ordinal < 2; ordinal++) {
            TypeRef.TypeParameterRef argument = (TypeRef.TypeParameterRef) openArguments.get(ordinal);
            assertEquals("T:" + IMPL + "TwoParameterGenericInterfaceImplementation`2", argument.owner().value());
            assertEquals(ordinal, argument.ordinal());
        }
        Edge.ImplementsMember partial = Models.one(Models.implementsMembersOf(model, "M:" + IMPL + "PartiallyClosedGenericInterfaceImplementation`1#map(java.lang.String)"), e -> true, "partial map");
        assertEquals("M:" + TWO + "#map(!0)", partial.to().value());
        assertEquals(TWO + "[java.lang.String,!0]", partial.interfaceType().canonical());
        assertEquals("T:" + IMPL + "PartiallyClosedGenericInterfaceImplementation`1", ((TypeRef.TypeParameterRef) ((TypeRef.Named) partial.interfaceType()).typeArguments().get(1)).owner().value());
        TypeNode record = Models.type(model, IMPL + "GenericRecordImplementation`1");
        assertTrue(record.modifiers().contains(Modifier.RECORD));
        assertEquals(List.of("java.lang.Record"), Models.extendsOf(model, record.id().value()));
        assertEquals(List.of(GENERIC_INTERFACE + "[!0]"), Models.implementsOf(model, record.id().value()));
        TypeRef.Named recordInterface = (TypeRef.Named) Models.edgesFrom(model, Edge.Implements.class, record.id().value()).get(0).to();
        assertEquals(record.id(), ((TypeRef.TypeParameterRef) recordInterface.typeArguments().get(0)).owner());
        assertEquals(List.of("M:" + GENERIC_INTERFACE + "#get()", "M:" + GENERIC_INTERFACE + "#put(!0)"),
                Models.implementsMembersDeclaredOn(model, record.id().value()).stream().map(e -> e.to().value()).toList());
        Edge.ImplementsMember generic = Models.one(Models.implementsMembersOf(model, "M:" + IMPL + "GenericMethodImplementation#genericMethodInInterface`1(!!0)"), e -> true, "generic slot");
        assertEquals("M:" + IMPL + "InterfaceWithGenericMethod#genericMethodInInterface`1(!!0)", generic.to().value());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void slotsOfADerivedInterfaceNameTheInterfaceThatDeclaresThem(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = IMPL + "DerivedInterfaceImplementation";
        List<Edge.ImplementsMember> slots = Models.implementsMembersDeclaredOn(model, "T:" + owner);
        assertEquals(4, slots.size());
        assertEquals(Map.of(
                "M:" + II + "BaseInterface#baseInterfaceMethod()", II + "BaseInterface",
                "M:" + II + "SecondBaseInterface#secondBaseInterfaceMethod()", II + "SecondBaseInterface",
                "M:" + II + "DerivedInterface#derivedInterfaceMethod()", II + "DerivedInterface",
                "M:" + II + "ThirdLevelInterface#thirdLevelMethod()", II + "ThirdLevelInterface"),
                slots.stream().collect(Collectors.toMap(e -> e.to().value(), e -> e.interfaceType().canonical())));
        assertTrue(slots.stream().allMatch(e -> e.from().value().startsWith("M:" + owner + "#")));
        assertEquals(List.of(II + "ThirdLevelInterface"), Models.implementsOf(model, "T:" + owner));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aMemberReAbstractedAlongTheInterfaceChainFillsEverySlot(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = IMPL + "HidingInterfaceMemberImplementation";
        assertEquals(List.of("M:" + II + "DerivedInterfaceHidingMember#first()", "M:" + II + "First#first()", "M:" + II + "Second#first()"),
                Models.implementsMembersOf(model, "M:" + owner + "#first()").stream().map(e -> e.to().value()).toList());
        assertEquals(List.of("M:" + II + "Second#second()"), Models.implementsMembersOf(model, "M:" + owner + "#second()").stream().map(e -> e.to().value()).toList());
        assertEquals(List.of(), Models.overridesOf(model, "M:" + owner + "#first()"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void nestedAndPrivateImplementationsMapLikeTopLevelOnes(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String hidden = IMPL + "NestedTypeImplementation+PrivateNestedImplementingInterface";
        assertEquals(Visibility.PRIVATE, Models.type(model, hidden).visibility());
        assertEquals(List.of(PLAIN_INTERFACE), Models.implementsOf(model, "T:" + hidden));
        Edge.ImplementsMember slot = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + hidden), e -> true, "private slot");
        assertEquals("M:" + hidden + "#abstractMethod()", slot.from().value());
        assertEquals(List.of(PLAIN_INTERFACE), Models.implementsOf(model, "T:" + IMPL + "NestedTypeImplementation+NestedImplementingInterface"));
        assertEquals(1, Models.invokesTo(model, "M:" + IMPL + "NestedTypeImplementation#createPrivateNested()", "M:" + hidden + "#.ctor()").size());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void frameworkInterfacesAreStubbedWithTheirMembers(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String owner = IMPL + "FrameworkInterfacesImplementation";
        assertEquals(List.of("java.lang.AutoCloseable", "java.lang.Comparable`1[" + owner + "]", "java.lang.Iterable`1[java.lang.Integer]"), Models.implementsOf(model, "T:" + owner));
        List<Edge.ImplementsMember> slots = Models.implementsMembersDeclaredOn(model, "T:" + owner);
        assertEquals(Map.of(
                "M:" + owner + "#close()", "M:java.lang.AutoCloseable#close()",
                "M:" + owner + "#compareTo(" + owner + ")", "M:java.lang.Comparable`1#compareTo(!0)",
                "M:" + owner + "#iterator()", "M:java.lang.Iterable`1#iterator()"),
                slots.stream().collect(Collectors.toMap(e -> e.from().value(), e -> e.to().value())));
        assertEquals("java.lang.Comparable`1[" + owner + "]", Models.one(slots, e -> e.from().value().contains("#compareTo("), "compareTo").interfaceType().canonical());
        for (String id : List.of("M:java.lang.AutoCloseable#close()", "M:java.lang.Comparable`1#compareTo(!0)", "M:java.lang.Iterable`1#iterator()")) {
            StubNode stub = Models.stub(model, id);
            assertEquals(StubKind.METHOD, stub.kind());
            assertEquals("A:java.base@17", stub.artifact().value());
        }
        assertEquals(List.of("M:java.lang.Object#equals(java.lang.Object)"), Models.overridesOf(model, "M:" + owner + "#equals(java.lang.Object)"));
        assertEquals(List.of("M:java.lang.Object#hashCode()"), Models.overridesOf(model, "M:" + owner + "#hashCode()"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aConstraintTypedReceiverCallsTheInterfaceDefinition(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode read = Models.method(model, IMPL + "InterfaceImplementationUsedThroughGenericConstraint#read`1(!!0)");
        assertEquals(List.of(GENERIC_INTERFACE + "[java.lang.String]"), Models.constraintsOf(read.typeParameters().get(0)));
        assertEquals(1, Models.invokesTo(model, read.id().value(), "M:" + GENERIC_INTERFACE + "#get()").size());
        MethodNode produce = Models.method(model, IMPL + "VarianceImplementation#produce(" + GENERIC_INTERFACE + "[<other:? extends java.lang.String>])");
        assertEquals(1, Models.invokesTo(model, produce.id().value(), "M:" + GENERIC_INTERFACE + "#get()").size());
        assertEquals(1, Models.invokesTo(model, "M:" + IMPL + "VarianceImplementation#consume(" + GENERIC_INTERFACE + "[<other:? super java.lang.String>])", "M:" + GENERIC_INTERFACE + "#put(!0)").size());
    }

    @ParameterizedTest
    @EnumSource(names = {"SOURCE", "HYBRID"})
    void aConstraintTypedReceiverIsAParameter(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(ExpressionKind.PARAMETER, Models.invokesTo(model, "M:" + IMPL + "InterfaceImplementationUsedThroughGenericConstraint#read`1(!!0)", "M:" + GENERIC_INTERFACE + "#get()").get(0).receiver());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void enumsAndRecordsFillSlotsLikeClasses(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String enumType = Models.SYNTAX + "types.EnumKinds+EnumImplementingInterface";
        assertEquals(List.of("java.lang.Enum`1[" + enumType + "]"), Models.extendsOf(model, "T:" + enumType));
        assertEquals(List.of(PLAIN_INTERFACE), Models.implementsOf(model, "T:" + enumType));
        Edge.ImplementsMember enumSlot = Models.one(Models.implementsMembersDeclaredOn(model, "T:" + enumType), e -> e.to().value().startsWith("M:" + PLAIN_INTERFACE), "enum slot of the own interface");
        assertEquals(List.of("M:java.lang.Comparable`1#compareTo(!0)", "M:java.lang.constant.Constable#describeConstable()"),
                Models.implementsMembersDeclaredOn(model, "T:" + enumType).stream().map(e -> e.to().value()).filter(to -> to.startsWith("M:java.")).sorted().collect(Collectors.toList()));
        assertEquals("M:" + enumType + "#abstractMethod()", enumSlot.from().value());
        assertEquals("M:" + PLAIN_INTERFACE + "#abstractMethod()", enumSlot.to().value());
        String recordType = Models.SYNTAX + "types.RecordKinds+RecordImplementingInterface";
        assertEquals(List.of(GENERIC_INTERFACE + "[java.lang.String]"), Models.implementsOf(model, "T:" + recordType));
        assertEquals(Map.of(
                "M:" + recordType + "#get()", "M:" + GENERIC_INTERFACE + "#get()",
                "M:" + recordType + "#put(java.lang.String)", "M:" + GENERIC_INTERFACE + "#put(!0)"),
                Models.implementsMembersDeclaredOn(model, "T:" + recordType).stream().collect(Collectors.toMap(e -> e.from().value(), e -> e.to().value())));
    }
}
