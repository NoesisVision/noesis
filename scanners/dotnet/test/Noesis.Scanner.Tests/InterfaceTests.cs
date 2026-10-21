using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class InterfaceTests(FixtureScan scan)
{
    private const string Interfaces = "CSharpSyntax.Interfaces.";
    private const string AllKinds = "csharp:T:CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds";

    [Fact]
    public void ImplicitImplementationMapsEveryMemberKind()
    {
        const string Type = "csharp:T:CSharpSyntax.Interfaces.ImplicitImplementation";
        Assert.Equal(["CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds"], scan.Main.ImplementsOf(Type));
        var mappings = scan.Main.Edges<ImplementsMemberEdge>().Where(edge => edge.DeclaredOn.Value == Type).ToList();
        Assert.Equal(5, mappings.Count);
        Assert.All(mappings, edge => Assert.Equal("CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds", edge.Interface.Canonical));
        Assert.Equal(
            [
                ("csharp:M:" + Interfaces + "ImplicitImplementation#GenericMethod`1(!!0)", "csharp:M:" + Interfaces + "IInterfaceWithAllMemberKinds#GenericMethod`1(!!0)"),
                ("csharp:M:" + Interfaces + "ImplicitImplementation#Method()", "csharp:M:" + Interfaces + "IInterfaceWithAllMemberKinds#Method()"),
                ("csharp:R:" + Interfaces + "ImplicitImplementation.Event", "csharp:R:" + Interfaces + "IInterfaceWithAllMemberKinds.Event"),
                ("csharp:R:" + Interfaces + "ImplicitImplementation.GetOnlyProperty", "csharp:R:" + Interfaces + "IInterfaceWithAllMemberKinds.GetOnlyProperty"),
                ("csharp:R:" + Interfaces + "ImplicitImplementation.this[int]", "csharp:R:" + Interfaces + "IInterfaceWithAllMemberKinds.this[int]"),
            ],
            mappings.Select(edge => (edge.From.Value, edge.To.Value)).Order());
        Assert.Empty(scan.Main.Method(Interfaces + "ImplicitImplementation#Method()").Language);
    }

    [Fact]
    public void ExplicitImplementationKeepsTheInterfaceInTheIdAndTheMemberNameAlone()
    {
        var method = scan.Main.Method(Interfaces + "ExplicitImplementation#CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.Method()");
        Assert.Equal("Method", method.Name);
        Assert.Equal(true, method.Bag("csharp.explicitInterfaceImplementation"));
        Assert.Equal(Visibility.Private, method.Visibility);
        Assert.Equal("GetOnlyProperty", scan.Main.Property(Interfaces + "ExplicitImplementation.CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.GetOnlyProperty").Name);
        Assert.Equal("this[]", scan.Main.Property(Interfaces + "ExplicitImplementation.CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.this[int]").Name);
        Assert.Equal([Accessor.Add, Accessor.Remove], scan.Main.Property(Interfaces + "ExplicitImplementation.CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.Event").Accessors);
        scan.Main.Method(Interfaces + "ExplicitImplementation#CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.GenericMethod`1(!!0)");
        Assert.Equal(5, scan.Main.Edges<ImplementsMemberEdge>().Count(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "ExplicitImplementation"));
        var mixed = scan.Main.Edges<ImplementsMemberEdge>().Where(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "MixedImplicitAndExplicitImplementation").Select(edge => edge.From.Value).Order().ToList();
        Assert.Contains("csharp:M:" + Interfaces + "MixedImplicitAndExplicitImplementation#Method()", mixed);
        Assert.Contains("csharp:R:" + Interfaces + "MixedImplicitAndExplicitImplementation.CSharpSyntax.Interfaces.IInterfaceWithAllMemberKinds.GetOnlyProperty", mixed);
    }

    [Fact]
    public void TwoInstantiationsOfOneGenericInterfaceStayApart()
    {
        var forInt = scan.Main.Method(Interfaces + "SameGenericInterfaceImplementedTwice#CSharpSyntax.Types.IGenericInterface`1[int].GetValue()");
        var forString = scan.Main.Method(Interfaces + "SameGenericInterfaceImplementedTwice#CSharpSyntax.Types.IGenericInterface`1[string].GetValue()");
        Assert.Equal("GetValue", forInt.Name);
        Expect.TypeRef("int", forInt.Signature.ReturnType);
        Expect.TypeRef("string", forString.Signature.ReturnType);
        var intMapping = Assert.Single(scan.Main.ImplementsMembersOf(forInt.Id.Value));
        Assert.Equal("csharp:M:CSharpSyntax.Types.IGenericInterface`1#GetValue()", intMapping.To.Value);
        Assert.Equal("CSharpSyntax.Types.IGenericInterface`1[int]", intMapping.Interface.Canonical);
        Assert.Equal("CSharpSyntax.Types.IGenericInterface`1[string]", Assert.Single(scan.Main.ImplementsMembersOf(forString.Id.Value)).Interface.Canonical);
        Assert.Equal(["CSharpSyntax.Types.IGenericInterface`1[int]", "CSharpSyntax.Types.IGenericInterface`1[string]"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "SameGenericInterfaceImplementedTwice").Order());
    }

    [Fact]
    public void GenericImplementationsCarryTheConstructedInterface()
    {
        Assert.Equal("CSharpSyntax.Types.IGenericInterface`1[int]", Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "ClosedGenericInterfaceImplementation#GetValue()")).Interface.Canonical);
        Assert.Equal("CSharpSyntax.Types.IGenericInterface`1[!0]", Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "OpenGenericInterfaceImplementation`1#GetValue()")).Interface.Canonical);
        var partiallyClosed = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "PartiallyClosedGenericInterfaceImplementation`1#Lookup(string)"));
        Assert.Equal("CSharpSyntax.Types.IGenericInterfaceWithTwoParameters`2[string,!0]", partiallyClosed.Interface.Canonical);
        Assert.Equal("csharp:M:CSharpSyntax.Types.IGenericInterfaceWithTwoParameters`2#Lookup(!0)", partiallyClosed.To.Value);
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "GenericStructImplementation`1#GetValue()"));
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "GenericRecordStructImplementation`1#GetValue()"));
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "ExplicitGenericMethodImplementation#CSharpSyntax.Types.IInterfaceWithGenericMethod.GenericMethodInInterface`1(!!0)"));
    }

    [Fact]
    public void AMemberOfABaseClassOrASharedMemberCanSatisfyTheInterface()
    {
        var satisfiedByBase = Assert.Single(scan.Main.Edges<ImplementsMemberEdge>(), edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "ImplementationSatisfiedByBaseClassMember");
        Assert.Equal("csharp:M:" + Interfaces + "BaseClassProvidingInterfaceMemberWithoutDeclaringInterface#MethodInInterface()", satisfiedByBase.From.Value);
        Assert.Equal("csharp:M:CSharpSyntax.Types.IPlainInterface#MethodInInterface()", satisfiedByBase.To.Value);
        var shared = scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "ConflictResolvedWithSharedImplementation#ConflictingName()").Select(edge => edge.To.Value).Order().ToList();
        Assert.Equal(["csharp:M:" + Interfaces + "IFirstConflictingInterface#ConflictingName()", "csharp:M:" + Interfaces + "ISecondConflictingInterface#ConflictingName()"], shared);
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "ConflictResolvedWithExplicitImplementations#CSharpSyntax.Interfaces.IFirstConflictingInterface.ConflictingName()"));
        var reimplemented = Assert.Single(scan.Main.Edges<ImplementsMemberEdge>(), edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "ReImplementationInDerivedClass" && edge.To.Value.EndsWith("#Method()", StringComparison.Ordinal));
        Assert.Equal("csharp:M:" + Interfaces + "ReImplementationInDerivedClass#Method()", reimplemented.From.Value);
        var overridden = Assert.Single(scan.Main.Edges<ImplementsMemberEdge>(), edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "OverriddenInterfaceImplementation");
        Assert.Equal("csharp:M:" + Interfaces + "VirtualImplementation#MethodInInterface()", overridden.From.Value);
        Assert.Equal(["csharp:M:" + Interfaces + "VirtualImplementation#MethodInInterface()"], scan.Main.OverridesOf("csharp:M:" + Interfaces + "OverriddenInterfaceImplementation#MethodInInterface()"));
        Assert.Equal(["CSharpSyntax.Types.IPlainInterface"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "VirtualImplementation"));
        Assert.Empty(scan.Main.ImplementsOf("csharp:T:" + Interfaces + "OverriddenInterfaceImplementation"));
    }

    [Fact]
    public void DefaultMembersNotOverriddenProduceNoMapping()
    {
        Assert.DoesNotContain(scan.Main.Edges<ImplementsMemberEdge>(), edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "DefaultMethodNotOverridden");
        Assert.Equal(["CSharpSyntax.Types.IInterfaceWithDefaultMethod"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "DefaultMethodNotOverridden"));
        Assert.Equal(2, scan.Main.Edges<ImplementsMemberEdge>().Count(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "DefaultMethodOverridden"));
        Assert.Single(scan.Main.Edges<ImplementsMemberEdge>(), edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "AccessibilityOnDefaultMembersImplementation");
    }

    [Fact]
    public void StaticAbstractMembersMapLikeInstanceOnes()
    {
        const string Type = "csharp:T:CSharpSyntax.Interfaces.StaticAbstractImplementation";
        var mappings = scan.Main.Edges<ImplementsMemberEdge>().Where(edge => edge.DeclaredOn.Value == Type).ToList();
        Assert.All(mappings, edge => Assert.Equal("CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1[CSharpSyntax.Interfaces.StaticAbstractImplementation]", edge.Interface.Canonical));
        Assert.Equal(
            [
                "csharp:M:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1#StaticAbstractFactory()",
                "csharp:M:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1#StaticVirtualMethod()",
                "csharp:M:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1#op_Addition(!0,!0)",
                "csharp:M:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1#op_Implicit(int):!0",
                "csharp:R:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1.StaticAbstractProperty",
            ],
            mappings.Select(edge => edge.To.Value).Order());
        Assert.Contains(mappings, edge => edge.From.Value == "csharp:M:" + Interfaces + "StaticAbstractImplementation#op_Implicit(int):CSharpSyntax.Interfaces.StaticAbstractImplementation");
        var explicitOperator = scan.Main.Nodes.OfType<MethodNode>().Single(node => node.Id.Value.StartsWith("csharp:M:" + Interfaces + "ExplicitStaticAbstractImplementation#", StringComparison.Ordinal) && node.Name == "op_Addition");
        Assert.Equal(true, explicitOperator.Bag("csharp.explicitInterfaceImplementation"));
        Assert.Equal(MethodKind.Operator, explicitOperator.MethodKind);
        Assert.Single(scan.Main.ImplementsMembersOf(explicitOperator.Id.Value));
        var viaConstraint = Assert.Single(scan.Main.Invokes("csharp:M:" + Interfaces + "InterfaceImplementationUsedThroughGenericConstraint`1#CreateViaStaticAbstract()"));
        Assert.Equal("csharp:M:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1#StaticAbstractFactory()", viaConstraint.To.Value);
        Assert.Equal(ExpressionKind.TypeParameter, viaConstraint.Receiver);
        var property = Assert.Single(scan.Main.Accesses("csharp:M:" + Interfaces + "InterfaceImplementationUsedThroughGenericConstraint`1#ReadStaticAbstractProperty()"));
        Assert.Equal(("csharp:R:CSharpSyntax.Types.IInterfaceWithStaticAbstractMembers`1.StaticAbstractProperty", ExpressionKind.TypeParameter), (property.To.Value, property.Receiver));
    }

    [Fact]
    public void VarianceAliasesPartialsAndNestedImplementations()
    {
        Assert.Equal(["CSharpSyntax.Types.IContravariantInterface`1[object]", "CSharpSyntax.Types.ICovariantInterface`1[string]"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "VarianceImplementation").Order());
        Assert.Equal(["CSharpSyntax.Types.IPlainInterface"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "ImplementationViaInterfaceAlias"));
        Assert.Equal(["CSharpSyntax.Types.IPlainInterface"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "ImplementationViaFullyQualifiedInterfaceName"));
        Assert.Equal(["CSharpSyntax.Types.IInterfaceWithProperty", "CSharpSyntax.Types.IPlainInterface"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "PartialClassImplementation").Order());
        Assert.Equal(2, scan.Main.Edges<ImplementsMemberEdge>().Count(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "PartialInterfaceImplementation"));
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "NestedTypeImplementation+PrivateNestedStructImplementingInterface#MethodInInterface()"));
        Assert.Equal(["CSharpSyntax.Types.IPlainInterface"], scan.Main.ImplementsOf("csharp:T:" + Interfaces + "RefStructImplementation"));
        Assert.Contains("CSharpSyntax.Types.IGenericInterface`1[int]", scan.Main.ImplementsOf("csharp:T:" + Interfaces + "RecordStructImplementation"));
        Assert.Equal(4, scan.Main.Edges<ImplementsMemberEdge>().Count(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "DerivedInterfaceImplementation"));
        Assert.Equal(2, scan.Main.Edges<ImplementsMemberEdge>().Count(edge => edge.DeclaredOn.Value == "csharp:T:" + Interfaces + "HidingInterfaceMemberImplementation"));
        var other = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Interfaces + "OtherProjectInterfaceImplementation#MethodFromOtherProjectInterface()"));
        Assert.Equal("csharp:M:CSharpSyntax.OtherProject.IInterfaceFromOtherProject#MethodFromOtherProjectInterface()", other.To.Value);
        Assert.False(scan.Main.HasStub(other.To.Value));
    }

    [Fact]
    public void FrameworkInterfacesAreStubbedWithTheirMembers()
    {
        const string Type = "CSharpSyntax.Interfaces.FrameworkInterfacesImplementation";
        var dispose = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Type + "#Dispose()"));
        Assert.Equal("csharp:M:System.IDisposable#Dispose()", dispose.To.Value);
        Assert.Equal("System.IDisposable", dispose.Interface.Canonical);
        var enumerator = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Type + "#GetEnumerator()"));
        Assert.Equal("csharp:M:System.Collections.Generic.IEnumerable`1#GetEnumerator()", enumerator.To.Value);
        Assert.Equal("System.Collections.Generic.IEnumerable`1[int]", enumerator.Interface.Canonical);
        var nonGeneric = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Type + "#System.Collections.IEnumerable.GetEnumerator()"));
        Assert.Equal("csharp:M:System.Collections.IEnumerable#GetEnumerator()", nonGeneric.To.Value);
        Assert.Equal(TypeKind.Interface, scan.Main.Stub("csharp:T:System.IDisposable").TypeKind);
        Assert.Equal("csharp:A:System.Runtime@10.0.0.0", scan.Main.Stub("csharp:T:System.IDisposable").Artifact!.Value.Value);
        Assert.Equal(StubKind.Method, scan.Main.Stub("csharp:M:System.IDisposable#Dispose()").Kind);
        Assert.Null(scan.Main.Stub("csharp:M:System.IDisposable#Dispose()").TypeKind);
        Assert.Contains(scan.Main.ExtendsOf("csharp:T:System.Collections.Generic.IEnumerable`1"), canonical => canonical == "System.Collections.IEnumerable");
        Assert.Equal(["csharp:M:System.Object#Equals(object)"], scan.Main.OverridesOf("csharp:M:" + Type + "#Equals(object)"));
        Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:" + Type + "#Equals(CSharpSyntax.Interfaces.FrameworkInterfacesImplementation)"));
    }
}
