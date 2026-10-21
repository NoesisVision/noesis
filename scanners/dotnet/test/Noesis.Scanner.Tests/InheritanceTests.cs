using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class InheritanceTests(FixtureScan scan)
{
    private const string Inheritance = "CSharpSyntax.Inheritance.";
    private const string BaseClass = "csharp:T:CSharpSyntax.Inheritance.BaseClass";
    private const string DerivedClass = "csharp:T:CSharpSyntax.Inheritance.DerivedClass";

    [Fact]
    public void ADeclaredBaseClassIsAnExtendsEdgeHoweverItIsSpelt()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.BaseClass"], scan.Main.ExtendsOf(DerivedClass));
        foreach (var derived in new[] { "DerivedFromTypeAlias", "DerivedFromFullyQualifiedName", "DerivedFromGlobalQualifiedName", "SealedDerivedClass", "PartialDerivedClass" })
            Assert.Equal(["CSharpSyntax.Inheritance.BaseClass"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + derived));
        Assert.Equal(["CSharpSyntax.Inheritance.DerivedClass"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "SecondLevelDerivedClass"));
        Assert.Equal(["CSharpSyntax.Inheritance.SecondLevelDerivedClass"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "ThirdLevelDerivedClass"));
        Assert.Equal(["CSharpSyntax.Types.OuterClassWithNestedTypes+PublicNestedClass"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromNestedClass"));
        Assert.Equal(["CSharpSyntax.Inheritance.OuterClassWithNestedDerivingFromOuter"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "OuterClassWithNestedDerivingFromOuter+NestedDerivedFromOuter"));
        Assert.Empty(scan.Main.ImplementsOf(DerivedClass));
    }

    [Fact]
    public void FrameworkAndOtherProjectBases()
    {
        Assert.Equal(["System.Collections.ObjectModel.Collection`1[int]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromFrameworkType"));
        Assert.Equal(["System.Exception"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromException"));
        Assert.Equal(["CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromOtherProjectClass"));
        Assert.False(scan.Main.HasStub("csharp:T:CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject"));
        Assert.Equal(["csharp:M:CSharpSyntax.OtherProject.AbstractBaseClassFromOtherProject#AbstractMethodFromOtherProject()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedFromOtherProjectClass#AbstractMethodFromOtherProject()"));
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedFromException#.ctor(string,System.Exception)"), edge => edge.To.Value == "csharp:M:System.Exception#.ctor(string,System.Exception)" && edge.Receiver == ExpressionKind.Base, "base constructor of a framework type");
        Assert.Equal(TypeKind.Class, scan.Main.Stub("csharp:T:System.Collections.ObjectModel.Collection`1").TypeKind);
        Assert.Contains(scan.Main.ImplementsOf("csharp:T:System.Collections.ObjectModel.Collection`1"), canonical => canonical == "System.Collections.Generic.IList`1[!0]");
    }

    [Fact]
    public void OverridesAreOneHopToTheDefinition()
    {
        Assert.Equal(["csharp:M:" + Inheritance + "BaseClass#VirtualMethod()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedClass#VirtualMethod()"));
        Assert.Equal(["csharp:M:" + Inheritance + "DerivedClass#VirtualMethod()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "SecondLevelDerivedClass#VirtualMethod()"));
        Assert.Equal(["csharp:R:" + Inheritance + "BaseClass.VirtualProperty"], scan.Main.OverridesOf("csharp:R:" + Inheritance + "DerivedClass.VirtualProperty"));
        Assert.Equal(["csharp:R:" + Inheritance + "BaseClass.this[int]"], scan.Main.OverridesOf("csharp:R:" + Inheritance + "DerivedClass.this[int]"));
        Assert.Equal(["csharp:R:" + Inheritance + "BaseClass.VirtualEvent"], scan.Main.OverridesOf("csharp:R:" + Inheritance + "DerivedClass.VirtualEvent"));
        Assert.Equal(["csharp:M:" + Inheritance + "BaseClass#CovariantReturnMethod()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedClass#CovariantReturnMethod()"));
        Expect.TypeRef("CSharpSyntax.Inheritance.DerivedClass", scan.Main.Method(Inheritance + "DerivedClass#CovariantReturnMethod()").Signature.ReturnType);
        Assert.Equal(["csharp:M:" + Inheritance + "BaseClass#VirtualGenericMethod`1(!!0)"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedClass#VirtualGenericMethod`1(!!0)"));
        Assert.Equal(["csharp:M:" + Inheritance + "BaseClass#ToString()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedClass#ToString()"));
        Assert.Equal(["csharp:M:System.Object#ToString()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "BaseClass#ToString()"));
        Assert.Equal(["csharp:M:System.Object#Equals(object)"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "BaseClass#Equals(object)"));
        Assert.Equal("Object", scan.Main.Stub("csharp:T:System.Object").Name);
        Assert.Equal(StubKind.Method, scan.Main.Stub("csharp:M:System.Object#ToString()").Kind);
        Assert.Equal(["csharp:M:" + Inheritance + "PartialDerivedClass#VirtualMethod()"], scan.Main.Edges<OverridesEdge>().Where(edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseClass#VirtualMethod()" && edge.From.Value.Contains("Partial")).Select(edge => edge.From.Value));
    }

    [Fact]
    public void OverrideModifiersSayWhetherTheMemberStaysOverridable()
    {
        Expect.Modifiers(scan.Main.Method(Inheritance + "BaseClass#VirtualMethod()").Modifiers, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Method(Inheritance + "DerivedClass#VirtualMethod()").Modifiers, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Method(Inheritance + "SecondLevelDerivedClass#VirtualMethod()").Modifiers, Modifier.Final);
        Expect.Modifiers(scan.Main.Property(Inheritance + "SecondLevelDerivedClass.VirtualProperty").Modifiers, Modifier.Final);
        Expect.Modifiers(scan.Main.Method(Inheritance + "DerivedClass#NonVirtualMethod()").Modifiers, Modifier.Hiding);
        Expect.Modifiers(scan.Main.Property(Inheritance + "DerivedClass.NonVirtualProperty").Modifiers, Modifier.Hiding);
        Expect.Modifiers(scan.Main.Type(Inheritance + "DerivedClass+NestedTypeToHide").Modifiers, Modifier.Hiding);
        Expect.Modifiers(scan.Main.Method(Inheritance + "DerivedClassWithImplicitHiding#VirtualMethod()").Modifiers);
        Expect.Modifiers(scan.Main.Method(Inheritance + "BaseClass#NonVirtualMethod()").Modifiers);
        Expect.Modifiers(scan.Main.Method(Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()").Modifiers, Modifier.Abstract);
        Assert.True(scan.Main.Method(Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()").Bodiless);
        Assert.Equal(["csharp:M:" + Inheritance + "AbstractBaseWithAllMemberKinds#VirtualMethodWithDefaultBody()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "AbstractIntermediate#VirtualMethodWithDefaultBody()"));
        Assert.Equal(Visibility.ProtectedOrArtifact, scan.Main.Method(Inheritance + "DerivedClass#ProtectedInternalVirtualMethod()").Visibility);
        Assert.Equal(Visibility.ProtectedAndArtifact, scan.Main.Method(Inheritance + "DerivedClass#PrivateProtectedVirtualMethod()").Visibility);
    }

    [Fact]
    public void ConstructorChainingIsAnInvokesWithBaseOrThisReceiver()
    {
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClass#.ctor()"), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseClass#.ctor()" && edge.Receiver == ExpressionKind.Base, "explicit base()");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClass#.ctor(int)"), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "base(value)");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClass#.ctor(int,string)"), edge => edge.To.Value == "csharp:M:" + Inheritance + "DerivedClass#.ctor(int)" && edge.Receiver == ExpressionKind.This, "this(value)");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClass#.ctor(string)"), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "base(value: ...)");
        Expect.One(scan.Main.Accesses("csharp:M:" + Inheritance + "DerivedClass#.ctor(string)"), edge => edge.To.Value == "csharp:R:System.String.Length" && edge.Receiver == ExpressionKind.Parameter, "argument expression inside the initializer");
        var primary = scan.Main.Method(Inheritance + "DerivedClassWithPrimaryConstructor#.ctor(int)");
        Assert.Equal(true, primary.Bag("csharp.primaryConstructor"));
        Expect.One(scan.Main.Invokes(primary.Id.Value), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseClass#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "primary constructor base call");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClassWithPrimaryConstructorAndExplicitConstructor#.ctor()"), edge => edge.To.Value == "csharp:M:" + Inheritance + "DerivedClassWithPrimaryConstructorAndExplicitConstructor#.ctor(int)" && edge.Receiver == ExpressionKind.This, "this(0) to the primary constructor");
        Assert.Empty(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedViaProtectedConstructor#.ctor()"));
        Assert.Equal(Origin.Generated, scan.Main.Method(Inheritance + "DerivedViaProtectedConstructor#.ctor()").Origin);
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "ConcreteCallingAbstractConstructor#.ctor()"), edge => edge.To.Value == "csharp:M:" + Inheritance + "AbstractClassWithConstructor#.ctor(int)", "abstract base constructor");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "ConcreteFromAbstractWithPrimaryConstructor#.ctor(int)"), edge => edge.To.Value == "csharp:M:" + Inheritance + "AbstractClassWithPrimaryConstructor#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "primary to primary");
        Assert.Equal(MethodKind.Destructor, scan.Main.Method(Inheritance + "DerivedClassWithFinalizer#Finalize()").MethodKind);
    }

    [Fact]
    public void BaseAccessInsideALambdaIsAttributedToTheMemberViaClosure()
    {
        var compute = Assert.Single(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedCallingBaseInsideLambda#Compute()"));
        Assert.Equal("csharp:M:" + Inheritance + "BaseClassCalledFromDerivedWithBaseKeyword#Compute()", compute.To.Value);
        Assert.Equal(ExpressionKind.Base, compute.Receiver);
        Assert.True(compute.Site.ViaClosure);
    }

    [Fact]
    public void InheritedStaticsAreUsedOnTheDeclaringType()
    {
        var read = Assert.Single(scan.Main.Accesses("csharp:M:" + Inheritance + "DerivedClassUsingInheritedStatics#ReadInheritedStaticField()"));
        Assert.Equal(("csharp:F:" + Inheritance + "BaseClassWithStaticMembers.StaticFieldOnBase", AccessKind.Read, ExpressionKind.Type), (read.To.Value, read.Access, read.Receiver));
        var call = Assert.Single(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedClassUsingInheritedStatics#CallInheritedStaticMethod()"));
        Assert.Equal(("csharp:M:" + Inheritance + "BaseClassWithStaticMembers#StaticMethodOnBase()", ExpressionKind.Type), (call.To.Value, call.Receiver));
        Assert.Equal(true, scan.Main.Property(Inheritance + "DerivedClassWithRequiredMember.RequiredOnDerived").Bag("csharp.required"));
    }

    [Fact]
    public void GenericBasesKeepTheirArguments()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[int]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromClosedGenericBase"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromOpenGenericBase`1"));
        var open = Assert.IsType<NamedTypeRef>(Assert.Single(scan.Main.EdgesFrom<ExtendsEdge>("csharp:T:" + Inheritance + "DerivedFromOpenGenericBase`1")).To);
        Assert.Equal("csharp:T:" + Inheritance + "DerivedFromOpenGenericBase`1", Assert.IsType<TypeParameterRef>(open.TypeArguments[0]).Owner.Value);
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromGenericBaseWithExtraParameter`2"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[System.Collections.Generic.List`1[System.Collections.Generic.Dictionary`2[string,int[]]]]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromNestedClosedGenericBase"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[(int,string)]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromGenericBaseWithTupleArgument"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[System.Nullable`1[int]]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromGenericBaseWithNullableArgument"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseClass`1[CSharpSyntax.OtherProject.PublicClassFromOtherProject]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromGenericBaseOfOtherProjectType"));
        Assert.Equal(["CSharpSyntax.OtherProject.GenericClassFromOtherProject`1[int]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromOtherProjectGenericClass"));
        Assert.Equal(["System.Collections.Generic.Dictionary`2[string,!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromFrameworkGenericClassWithOwnParameter`1"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericClassWithNestedDerivedClass`1[!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromGenericOuter"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericClassWithNestedDerivedClass`1[int]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "GenericClassWithNestedDerivedClass`1+NestedDerivedFromClosedGenericOuter"));
        Assert.Equal(["CSharpSyntax.Inheritance.SelfReferencingGenericBase`1[CSharpSyntax.Inheritance.DerivedFromSelfReferencingGeneric]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromSelfReferencingGeneric"));
        Assert.Equal("CSharpSyntax.Inheritance.SelfReferencingGenericBase`1[!0]", Assert.IsType<TypeConstraint>(Assert.Single(scan.Main.Type(Inheritance + "SelfReferencingGenericBase`1").TypeParameters[0].Constraints)).Type.Canonical);

        Assert.Equal(["csharp:M:" + Inheritance + "GenericBaseClass`1#GenericVirtualMethod(!0)"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedFromClosedGenericBase#GenericVirtualMethod(int)"));
        Assert.Equal(["csharp:R:" + Inheritance + "GenericBaseClass`1.GenericValue"], scan.Main.OverridesOf("csharp:R:" + Inheritance + "DerivedFromClosedGenericBase.GenericValue"));
        Assert.Equal(["csharp:M:" + Inheritance + "GenericBaseClass`1#GenericVirtualMethod(!0)"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedFromOpenGenericBase`1#GenericVirtualMethod(!0)"));
        Assert.Equal(["csharp:M:" + Inheritance + "GenericAbstractBase`1#Create()"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "ConcreteFromGenericAbstract#Create()"));
    }

    [Fact]
    public void InterfaceInheritanceIsExtends()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.IBaseInterface"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IDerivedInterface"));
        Assert.Equal(["CSharpSyntax.Inheritance.IBaseInterface", "CSharpSyntax.Inheritance.ISecondBaseInterface"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IDerivedFromTwoInterfaces").Order());
        Assert.Equal(["CSharpSyntax.Inheritance.IDerivedFromTwoInterfaces", "CSharpSyntax.Inheritance.IDerivedInterface"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IThirdLevelInterface").Order());
        Assert.Empty(scan.Main.ImplementsOf("csharp:T:" + Inheritance + "IDerivedInterface"));
        Assert.Equal(["CSharpSyntax.Types.IGenericInterface`1[int]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IDerivedFromClosedGenericInterface"));
        Assert.Equal(["CSharpSyntax.Types.IGenericInterface`1[!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IGenericDerivedInterface`1"));
        Assert.Equal(["System.IComparable`1[CSharpSyntax.Inheritance.IDerivedFromFrameworkInterfaces]", "System.IDisposable"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "IDerivedFromFrameworkInterfaces").Order());
        Expect.Modifiers(scan.Main.Method(Inheritance + "IDerivedInterfaceHidingMember#BaseInterfaceMethod()").Modifiers, Modifier.Abstract, Modifier.Hiding);
        var reimplementation = scan.Main.Method(Inheritance + "IDerivedInterfaceOverridingDefaultImplementation#CSharpSyntax.Types.IInterfaceWithDefaultMethod.MethodWithDefaultBody()");
        Assert.Equal(true, reimplementation.Bag("csharp.explicitInterfaceImplementation"));
        var mapping = Assert.Single(scan.Main.ImplementsMembersOf(reimplementation.Id.Value));
        Assert.Equal("csharp:M:CSharpSyntax.Types.IInterfaceWithDefaultMethod#MethodWithDefaultBody()", mapping.To.Value);
        Assert.Equal("csharp:T:" + Inheritance + "IDerivedInterfaceOverridingDefaultImplementation", mapping.DeclaredOn.Value);
        Expect.Modifiers(scan.Main.Method(Inheritance + "IDerivedInterfaceAddingStaticAbstract`1#AdditionalFactory()").Modifiers, Modifier.Static, Modifier.Abstract);
    }

    [Fact]
    public void RecordInheritance()
    {
        Assert.Equal(["CSharpSyntax.Inheritance.BaseRecord"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedRecord"));
        Expect.Modifiers(scan.Main.Type(Inheritance + "SealedDerivedRecord").Modifiers, Modifier.Final, Modifier.Record);
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "DerivedRecord#.ctor(int,string)"), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseRecord#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "record primary constructor base call");
        Expect.One(scan.Main.Invokes("csharp:M:" + Inheritance + "RecordDerivedFromRecordWithBodyOnly#.ctor()"), edge => edge.To.Value == "csharp:M:" + Inheritance + "BaseRecord#.ctor(int)" && edge.Receiver == ExpressionKind.Base, "explicit base(0)");
        Assert.Equal(["csharp:R:" + Inheritance + "AbstractBaseRecord.AbstractPropertyInRecord"], scan.Main.OverridesOf("csharp:R:" + Inheritance + "ConcreteRecordFromAbstract.AbstractPropertyInRecord"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseRecord`1[string]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromGenericRecord"));
        Assert.Equal(["CSharpSyntax.Inheritance.GenericBaseRecord`1[!0]"], scan.Main.ExtendsOf("csharp:T:" + Inheritance + "DerivedFromOpenGenericRecord`1"));
        Assert.Equal(["csharp:M:" + Inheritance + "BaseRecord#Equals(CSharpSyntax.Inheritance.BaseRecord)"], scan.Main.OverridesOf("csharp:M:" + Inheritance + "DerivedRecord#Equals(CSharpSyntax.Inheritance.BaseRecord)"));
    }
}
