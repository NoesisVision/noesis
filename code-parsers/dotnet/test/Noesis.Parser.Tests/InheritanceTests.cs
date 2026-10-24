using Noesis.Parser.Model;
using Noesis.Parser.Tests.Infrastructure;

namespace Noesis.Parser.Tests;

public class InheritanceTests(ParsedFixture parsed)
{
    private const string Inheritance = "CSharpSyntax.Inheritance.";
    private const string BaseClass = "T:CSharpSyntax.Inheritance.BaseClass";
    private const string DerivedClass = "T:CSharpSyntax.Inheritance.DerivedClass";

    [Fact]
    public void ADeclaredBaseClassIsAnExtendsEdgeHoweverItIsSpelt()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.BaseClass"], parsed.Main.ExtendsOf(DerivedClass));
        foreach (var derived in new[] { "DerivedFromTypeAlias", "DerivedFromFullyQualifiedName", "DerivedFromGlobalQualifiedName", "SealedDerivedClass", "PartialDerivedClass" })
            Assert.Equal(["CSharpSyntax.Inheritance.BaseClass"], parsed.Main.ExtendsOf("T:" + Inheritance + derived));
        Assert.Equal(["CSharpSyntax.Inheritance.DerivedClass"], parsed.Main.ExtendsOf("T:" + Inheritance + "SecondLevelDerivedClass"));
        Assert.Equal(["CSharpSyntax.Inheritance.SecondLevelDerivedClass"], parsed.Main.ExtendsOf("T:" + Inheritance + "ThirdLevelDerivedClass"));
        Assert.Equal(["CSharpSyntax.Types.OuterClassWithNestedTypes+PublicNestedClass"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromNestedClass"));
        Assert.Equal(["CSharpSyntax.Inheritance.OuterClassWithNestedDerivingFromOuter"], parsed.Main.ExtendsOf("T:" + Inheritance + "OuterClassWithNestedDerivingFromOuter+NestedDerivedFromOuter"));
        Assert.Empty(parsed.Main.ImplementsOf(DerivedClass));
    }

    [Fact]
    public void FrameworkAndOtherProjectBases()
    {
        Assert.Equal(["System.Collections.ObjectModel.Collection`1[int]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromFrameworkType"));
        Assert.Equal(["System.Exception"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromException"));
        Assert.Equal(["CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromOtherProjectClass"));
        Assert.False(parsed.Main.HasStub("T:CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject"));
        Assert.Equal(["M:CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject#AbstractMethodFromOtherProject()"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedFromOtherProjectClass#AbstractMethodFromOtherProject()"));
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedFromException#.ctor(string,System.Exception)"), edge => edge.To.Value == "M:System.Exception#.ctor(string,System.Exception)" && edge.Receiver == ExpressionKind.Base, "base constructor of a framework type");
        Assert.Equal(TypeKind.Class, parsed.Main.Stub("T:System.Collections.ObjectModel.Collection`1").TypeKind);
        Assert.Contains(parsed.Main.ImplementsOf("T:System.Collections.ObjectModel.Collection`1"), canonical => canonical == "System.Collections.Generic.IList`1[!0]");
    }

    [Fact]
    public void OverridesAreOneHopToTheDefinition()
    {
        Assert.Equal(["M:" + Inheritance + "BaseClass#VirtualMethod()"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedClass#VirtualMethod()"));
        Assert.Equal(["M:" + Inheritance + "DerivedClass#VirtualMethod()"], parsed.Main.OverridesOf("M:" + Inheritance + "SecondLevelDerivedClass#VirtualMethod()"));
        Assert.Equal(["P:" + Inheritance + "BaseClass.VirtualProperty"], parsed.Main.OverridesOf("P:" + Inheritance + "DerivedClass.VirtualProperty"));
        Assert.Equal(["P:" + Inheritance + "BaseClass.this[int]"], parsed.Main.OverridesOf("P:" + Inheritance + "DerivedClass.this[int]"));
        Assert.Equal(["P:" + Inheritance + "BaseClass.VirtualEvent"], parsed.Main.OverridesOf("P:" + Inheritance + "DerivedClass.VirtualEvent"));
        Assert.Equal(["M:" + Inheritance + "BaseClass#CovariantReturnMethod()"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedClass#CovariantReturnMethod()"));
        Expect.TypeRef("CSharpSyntax.Inheritance.DerivedClass", parsed.Main.Method(Inheritance + "DerivedClass#CovariantReturnMethod()").Signature.ReturnType);
        Assert.Equal(["M:" + Inheritance + "BaseClass#VirtualGenericMethod`1(!!0)"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedClass#VirtualGenericMethod`1(!!0)"));
        Assert.Equal(["M:" + Inheritance + "BaseClass#ToString()"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedClass#ToString()"));
        Assert.Equal(["M:System.Object#ToString()"], parsed.Main.OverridesOf("M:" + Inheritance + "BaseClass#ToString()"));
        Assert.Equal(["M:System.Object#Equals(object)"], parsed.Main.OverridesOf("M:" + Inheritance + "BaseClass#Equals(object)"));
        Assert.Equal("Object", parsed.Main.Stub("T:System.Object").Name);
        Assert.Equal(StubKind.Method, parsed.Main.Stub("M:System.Object#ToString()").Kind);
        Assert.Equal(["M:" + Inheritance + "PartialDerivedClass#VirtualMethod()"], parsed.Main.Edges<OverridesEdge>().Where(edge => edge.To.Value == "M:" + Inheritance + "BaseClass#VirtualMethod()" && edge.From.Value.Contains("Partial")).Select(edge => edge.From.Value));
    }

    [Fact]
    public void OverrideModifiersSayWhetherTheMemberStaysOverridable()
    {
        Expect.Modifiers(parsed.Main.Method(Inheritance + "BaseClass#VirtualMethod()").Modifiers, Modifier.Virtual);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "DerivedClass#VirtualMethod()").Modifiers, Modifier.Virtual);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "SecondLevelDerivedClass#VirtualMethod()").Modifiers, Modifier.Final);
        Expect.Modifiers(parsed.Main.Property(Inheritance + "SecondLevelDerivedClass.VirtualProperty").Modifiers, Modifier.Final);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "DerivedClass#NonVirtualMethod()").Modifiers, Modifier.Hiding);
        Expect.Modifiers(parsed.Main.Property(Inheritance + "DerivedClass.NonVirtualProperty").Modifiers, Modifier.Hiding);
        Expect.Modifiers(parsed.Main.Type(Inheritance + "DerivedClass+NestedTypeToHide").Modifiers, Modifier.Hiding);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "DerivedClassWithImplicitHiding#VirtualMethod()").Modifiers);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "BaseClass#NonVirtualMethod()").Modifiers);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()").Modifiers, Modifier.Abstract);
        Assert.True(parsed.Main.Method(Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()").Bodiless);
        Assert.Equal(["M:" + Inheritance + "AbstractBaseWithAllMemberKinds#VirtualMethodWithDefaultBody()"], parsed.Main.OverridesOf("M:" + Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()"));
        Assert.Equal(Visibility.ProtectedOrArtifact, parsed.Main.Method(Inheritance + "DerivedClass#ProtectedInternalVirtualMethod()").Visibility);
        Assert.Equal(Visibility.ProtectedAndArtifact, parsed.Main.Method(Inheritance + "DerivedClass#PrivateProtectedVirtualMethod()").Visibility);
    }

    [Fact]
    public void ConstructorChainingIsAnInvokesWithBaseOrThisReceiver()
    {
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedClass#.ctor()"), edge => edge.To.Value == "M:" + Inheritance + "BaseClass#.ctor()" && edge.Receiver == ExpressionKind.Base, "explicit base()");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedClass#.ctor(int)"), edge => edge.To.Value == "M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "base(value)");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedClass#.ctor(int,string)"), edge => edge.To.Value == "M:" + Inheritance + "DerivedClass#.ctor(int)" && edge.Receiver == ExpressionKind.This, "this(value)");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedClass#.ctor(string)"), edge => edge.To.Value == "M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "base(value: ...)");
        Expect.One(parsed.Main.Accesses("M:" + Inheritance + "DerivedClass#.ctor(string)"), edge => edge.To.Value == "P:System.String.Length" && edge.Receiver == ExpressionKind.Parameter, "argument expression inside the initializer");
        var primary = parsed.Main.Method(Inheritance + "DerivedClassWithPrimaryConstructor#.ctor(int)");
        Assert.Equal(true, primary.Bag("csharp.primaryConstructor"));
        Expect.One(parsed.Main.Invokes(primary.Id.Value), edge => edge.To.Value == "M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "primary constructor base call");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedClassWithPrimaryConstructorAndExplicitConstructor#.ctor()"), edge => edge.To.Value == "M:" + Inheritance + "DerivedClassWithPrimaryConstructorAndExplicitConstructor#.ctor(int)" && edge.Receiver == ExpressionKind.This, "this(0) to the primary constructor");
        Assert.Empty(parsed.Main.Invokes("M:" + Inheritance + "DerivedViaProtectedConstructor#.ctor()"));
        Assert.Equal(Origin.Generated, parsed.Main.Method(Inheritance + "DerivedViaProtectedConstructor#.ctor()").Origin);
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "ConcreteCallingAbstractConstructor#.ctor()"), edge => edge.To.Value == "M:" + Inheritance + "AbstractClassWithConstructor#.ctor(int)", "abstract base constructor");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "ConcreteFromAbstractWithPrimaryConstructor#.ctor(int)"), edge => edge.To.Value == "M:" + Inheritance + "AbstractClassWithPrimaryConstructor#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "primary to primary");
        Assert.Equal(MethodKind.Destructor, parsed.Main.Method(Inheritance + "DerivedClassWithFinalizer#Finalize()").MethodKind);
    }

    [Fact]
    public void BaseAccessInsideALambdaIsAttributedToTheMemberViaClosure()
    {
        var compute = Assert.Single(parsed.Main.Invokes("M:" + Inheritance + "DerivedCallingBaseInsideLambda#Compute()"));
        Assert.Equal("M:" + Inheritance + "BaseClassCalledFromDerivedWithBaseKeyword#Compute()", compute.To.Value);
        Assert.Equal(ExpressionKind.Base, compute.Receiver);
        Assert.True(compute.Site.ViaClosure);
    }

    [Fact]
    public void InheritedStaticsAreUsedOnTheDeclaringType()
    {
        var read = Assert.Single(parsed.Main.Accesses("M:" + Inheritance + "DerivedClassUsingInheritedStatics#ReadInheritedStaticField()"));
        Assert.Equal(("F:" + Inheritance + "BaseClassWithStaticMembers.StaticFieldOnBase", AccessKind.Read, ExpressionKind.Type), (read.To.Value, read.Access, read.Receiver));
        var call = Assert.Single(parsed.Main.Invokes("M:" + Inheritance + "DerivedClassUsingInheritedStatics#CallInheritedStaticMethod()"));
        Assert.Equal(("M:" + Inheritance + "BaseClassWithStaticMembers#StaticMethodOnBase()", ExpressionKind.Type), (call.To.Value, call.Receiver));
        Assert.Equal(true, parsed.Main.Property(Inheritance + "DerivedClassWithRequiredMember.RequiredOnDerived").Bag("csharp.required"));
    }

    [Fact]
    public void GenericBasesKeepTheirArguments()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[int]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromClosedGenericBase"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromOpenGenericBase`1"));
        var open = Assert.IsType<NamedTypeRef>(Assert.Single(parsed.Main.EdgesFrom<ExtendsEdge>("T:" + Inheritance + "DerivedFromOpenGenericBase`1")).To);
        Assert.Equal("T:" + Inheritance + "DerivedFromOpenGenericBase`1", Assert.IsType<TypeParameterRef>(open.TypeArguments[0]).Owner.Value);
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromGenericBaseWithExtraParameter`2"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[System.Collections.Generic.List`1[System.Collections.Generic.Dictionary`2[string,int[]]]]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromNestedClosedGenericBase"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[(int,string)]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromGenericBaseWithTupleArgument"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[System.Nullable`1[int]]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromGenericBaseWithNullableArgument"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[CSharpSyntax.OtherProject.PublicClassFromOtherProject]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromGenericBaseOfOtherProjectType"));
        Assert.Equal(["CSharpSyntax.OtherProject.GenericClassFromOtherProject`1[int]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromOtherProjectGenericClass"));
        Assert.Equal(["System.Collections.Generic.Dictionary`2[string,!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromFrameworkGenericClassWithOwnParameter`1"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericClassWithNestedDerivedClass`1[!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromGenericOuter"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericClassWithNestedDerivedClass`1[int]"], parsed.Main.ExtendsOf("T:" + Inheritance + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromClosedGenericOuter"));
        Assert.Equal(["CSharpSyntax.Inheritance.SelfReferencingGenericBase`1[CSharpSyntax.Inheritance.DerivedFromSelfReferencingGeneric]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromSelfReferencingGeneric"));
        Assert.Equal("CSharpSyntax.Inheritance.SelfReferencingGenericBase`1[!0]", Assert.IsType<TypeConstraint>(Assert.Single(parsed.Main.Type(Inheritance + "SelfReferencingGenericBase`1").TypeParameters[0].Constraints)).Type.Canonical);

        Assert.Equal(["M:" + Inheritance + "GenericBaseClass`1#GenericVirtualMethod(!0)"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedFromClosedGenericBase#GenericVirtualMethod(int)"));
        Assert.Equal(["P:" + Inheritance + "GenericBaseClass`1.GenericValue"], parsed.Main.OverridesOf("P:" + Inheritance + "DerivedFromClosedGenericBase.GenericValue"));
        Assert.Equal(["M:" + Inheritance + "GenericBaseClass`1#GenericVirtualMethod(!0)"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedFromOpenGenericBase`1#GenericVirtualMethod(!0)"));
        Assert.Equal(["M:" + Inheritance + "GenericAbstractBase`1#Create()"], parsed.Main.OverridesOf("M:" + Inheritance + "ConcreteFromGenericAbstract#Create()"));
    }

    [Fact]
    public void InterfaceInheritanceIsExtends()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.IBaseInterface"], parsed.Main.ExtendsOf("T:" + Inheritance + "IDerivedInterface"));
        Assert.Equal(["CSharpSyntax.Inheritance.IBaseInterface", "CSharpSyntax.Inheritance.ISecondBaseInterface"], parsed.Main.ExtendsOf("T:" + Inheritance + "IDerivedFromTwoInterfaces").Order());
        Assert.Equal(["CSharpSyntax.Inheritance.IDerivedFromTwoInterfaces", "CSharpSyntax.Inheritance.IDerivedInterface"], parsed.Main.ExtendsOf("T:" + Inheritance + "IThirdLevelInterface").Order());
        Assert.Empty(parsed.Main.ImplementsOf("T:" + Inheritance + "IDerivedInterface"));
        Assert.Equal(["CSharpSyntax.Types.IGenericInterface`1[int]"], parsed.Main.ExtendsOf("T:" + Inheritance + "IDerivedFromClosedGenericInterface"));
        Assert.Equal(["CSharpSyntax.Types.IGenericInterface`1[!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "IGenericDerivedInterface`1"));
        Assert.Equal(["System.IComparable`1[CSharpSyntax.Inheritance.IDerivedFromFrameworkInterfaces]", "System.IDisposable"], parsed.Main.ExtendsOf("T:" + Inheritance + "IDerivedFromFrameworkInterfaces").Order());
        Expect.Modifiers(parsed.Main.Method(Inheritance + "IDerivedInterfaceHidingMember#BaseInterfaceMethod()").Modifiers, Modifier.Abstract, Modifier.Hiding);
        var reimplementation = parsed.Main.Method(Inheritance + "IDerivedInterfaceOverridingDefaultImplementation#CSharpSyntax.Types.IInterfaceWithDefaultMethod.MethodWithDefaultBody()");
        Assert.Equal(true, reimplementation.Bag("csharp.explicitInterfaceImplementation"));
        var mapping = Assert.Single(parsed.Main.ImplementsMembersOf(reimplementation.Id.Value));
        Assert.Equal("M:CSharpSyntax.Types.IInterfaceWithDefaultMethod#MethodWithDefaultBody()", mapping.To.Value);
        Assert.Equal("T:" + Inheritance + "IDerivedInterfaceOverridingDefaultImplementation", mapping.DeclaredOn.Value);
        Expect.Modifiers(parsed.Main.Method(Inheritance + "IDerivedInterfaceAddingStaticAbstract`1#AdditionalFactory()").Modifiers, Modifier.Static, Modifier.Abstract);
    }

    [Fact]
    public void RecordInheritance()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.BaseRecord"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedRecord"));
        Expect.Modifiers(parsed.Main.Type(Inheritance + "SealedDerivedRecord").Modifiers, Modifier.Final, Modifier.Record);
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "DerivedRecord#.ctor(int,string)"), edge => edge.To.Value == "M:" + Inheritance + "BaseRecord#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "record primary constructor base call");
        Expect.One(parsed.Main.Invokes("M:" + Inheritance + "RecordDerivedFromRecordWithBodyOnly#.ctor()"), edge => edge.To.Value == "M:" + Inheritance + "BaseRecord#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "explicit base(0)");
        Assert.Equal(["P:" + Inheritance + "AbstractBaseRecord.AbstractPropertyInRecord"], parsed.Main.OverridesOf("P:" + Inheritance + "ConcreteRecordFromAbstract.AbstractPropertyInRecord"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseRecord`1[string]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromGenericRecord"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseRecord`1[!0]"], parsed.Main.ExtendsOf("T:" + Inheritance + "DerivedFromOpenGenericRecord`1"));
        Assert.Equal(["M:" + Inheritance + "BaseRecord#Equals(CSharpSyntax.Inheritance.BaseRecord)"], parsed.Main.OverridesOf("M:" + Inheritance + "DerivedRecord#Equals(CSharpSyntax.Inheritance.BaseRecord)"));
    }
}
