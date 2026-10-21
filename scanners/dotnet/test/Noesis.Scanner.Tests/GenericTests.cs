using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class GenericTests(FixtureScan scan)
{
    private const string Generics = "CSharpSyntax.Generics.";
    private const string OneParameter = "csharp:T:CSharpSyntax.Generics.GenericClassWithOneParameter`1";

    [Fact]
    public void TypeParametersAreDeclaredOnTheOwnerWithFlattenedOrdinals()
    {
        var outer = scan.Main.Type(Generics + "GenericClassWithOneParameter`1");
        var parameter = Assert.Single(outer.TypeParameters);
        Assert.Equal("T", parameter.Name);
        Assert.Equal(0, parameter.Ordinal);
        Assert.Equal(Variance.Invariant, parameter.Variance);
        Assert.Empty(parameter.Constraints);

        var nestedSharing = scan.Main.Type(Generics + "GenericClassWithOneParameter`1+NestedClassSharingOuterParameter");
        Assert.Empty(nestedSharing.TypeParameters);
        var fromOuter = Assert.IsType<TypeParameterRef>(scan.Main.Field(Generics + "GenericClassWithOneParameter`1+NestedClassSharingOuterParameter.ValueFromOuter").Type);
        Assert.Equal(OneParameter, fromOuter.Owner.Value);
        Assert.Equal(0, fromOuter.Ordinal);
        Assert.True(fromOuter.Nullable);

        var nestedGeneric = scan.Main.Type(Generics + "GenericClassWithOneParameter`1+NestedGenericClass`1");
        var inner = Assert.Single(nestedGeneric.TypeParameters);
        Assert.Equal("TInner", inner.Name);
        Assert.Equal(1, inner.Ordinal);
        var pair = Assert.IsType<TupleTypeRef>(scan.Main.Field(Generics + "GenericClassWithOneParameter`1+NestedGenericClass`1.Pair").Type);
        Assert.Equal("(!0,!1)", pair.Canonical);
        Assert.Equal(OneParameter, Assert.IsType<TypeParameterRef>(pair.Elements[0].Type).Owner.Value);
        Assert.Equal(nestedGeneric.Id, Assert.IsType<TypeParameterRef>(pair.Elements[1].Type).Owner);
        Assert.Equal(["Outer", "Inner"], pair.Elements.Select(element => element.Name));
    }

    [Fact]
    public void ADefinitionUsedInsideItselfCarriesItsOwnParameters()
    {
        Expect.TypeRef("!0?", scan.Main.Property(Generics + "GenericClassWithOneParameter`1.Value").Type);
        Expect.TypeRef("!0[]", scan.Main.Property(Generics + "GenericClassWithOneParameter`1.Values").Type);
        Expect.TypeRef("System.Collections.Generic.List`1[!0]", scan.Main.Property(Generics + "GenericClassWithOneParameter`1.List").Type);
        Expect.TypeRef("CSharpSyntax.Generics.GenericClassWithOneParameter`1[!0]", scan.Main.Property(Generics + "GenericClassWithOneParameter`1.Self").Type);
        Expect.TypeRef("CSharpSyntax.Generics.GenericClassWithOneParameter`1[System.Collections.Generic.List`1[!0]]", scan.Main.Property(Generics + "GenericClassWithOneParameter`1.Nested").Type);
        Expect.TypeRef("CSharpSyntax.Generics.GenericClassWithTwoParameters`2[!1,!0]", scan.Main.Property(Generics + "GenericClassWithTwoParameters`2.Swapped").Type);
        Assert.All(scan.Main.Type(Generics + "GenericClassWithTwoParameters`2").TypeParameters, parameter => Assert.IsType<NotNullConstraint>(Assert.Single(parameter.Constraints)));
    }

    [Theory]
    [InlineData("ClosedWithValueType", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[int]")]
    [InlineData("ClosedWithReferenceType", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[string]")]
    [InlineData("ClosedWithNullableValueType", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[System.Nullable`1[int]]")]
    [InlineData("ClosedWithNullableReferenceType", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[string?]")]
    [InlineData("ClosedWithArray", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[int[]]")]
    [InlineData("ClosedWithTuple", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[(int,string)]")]
    [InlineData("ClosedWithGeneric", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[CSharpSyntax.Generics.GenericClassWithOneParameter`1[int]]")]
    [InlineData("ClosedTwoParameters", "CSharpSyntax.Generics.GenericClassWithTwoParameters`2[int,string]")]
    [InlineData("ClosedNested", "CSharpSyntax.Generics.GenericClassWithOneParameter`1+NestedClassSharingOuterParameter[int]")]
    [InlineData("ClosedNestedGeneric", "CSharpSyntax.Generics.GenericClassWithOneParameter`1+NestedGenericClass`1[int,string]")]
    [InlineData("ClosedWithDynamic", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[dynamic]")]
    [InlineData("ClosedWithObject", "CSharpSyntax.Generics.GenericClassWithOneParameter`1[object]")]
    [InlineData("ClosedDelegate", "CSharpSyntax.Generics.GenericDelegateWithTwoParameters`2[int,string]")]
    [InlineData("OpenGenericTypeOf", "System.Type")]
    public void ConstructedTypesFlattenTheirArguments(string field, string canonical) =>
        Expect.TypeRef(canonical, scan.Main.Field(Generics + "ClosedGenericUsages." + field).Type);

    [Fact]
    public void TypesOfTheSameNameAndDifferentArityAreDistinct()
    {
        scan.Main.Type(Generics + "GenericClassWithOneParameter`2");
        Assert.Equal(2, scan.Main.Type(Generics + "GenericClassWithOneParameter`2").TypeParameters.Count);
        Assert.Equal(1, Assert.Single(scan.Main.Type(Generics + "NonGenericClassWithGenericNested+GenericNested`1").TypeParameters).Ordinal + 1);
    }

    [Fact]
    public void ConstraintKinds()
    {
        TypeParameterConstraint[] Of(string type) => scan.Main.Type(Generics + type).TypeParameters[0].Constraints.ToArray();
        Assert.IsType<ReferenceTypeConstraint>(Assert.Single(Of("GenericClassWithClassConstraint`1")));
        Assert.IsType<ValueTypeConstraint>(Assert.Single(Of("GenericClassWithStructConstraint`1")));
        Assert.IsType<ParameterlessConstructorConstraint>(Assert.Single(Of("GenericClassWithNewConstraint`1")));
        Assert.Equal("System.Exception", Assert.IsType<TypeConstraint>(Assert.Single(Of("GenericClassWithBaseClassConstraint`1"))).Type.Canonical);
        Assert.Equal("System.IDisposable", Assert.IsType<TypeConstraint>(Assert.Single(Of("GenericClassWithInterfaceConstraint`1"))).Type.Canonical);
        Assert.IsType<NotNullConstraint>(Assert.Single(Of("GenericClassWithNotNullConstraint`1")));
        Assert.IsType<ValueTypeConstraint>(Assert.Single(Of("GenericClassWithUnmanagedConstraint`1")));
        Assert.Equal(true, scan.Main.Type(Generics + "GenericClassWithUnmanagedConstraint`1").TypeParameters[0].Language["csharp.unmanaged"]);
        Assert.Equal(["valueType", "System.Enum"], Of("GenericClassWithEnumConstraint`1").Select(Describe));
        Assert.Equal(["System.Delegate"], Of("GenericClassWithDelegateConstraint`1").Select(Describe));
        Assert.Equal(["referenceType"], Of("GenericClassWithNullableClassConstraint`1").Select(Describe));
        Assert.Equal(true, scan.Main.Type(Generics + "GenericClassWithNullableClassConstraint`1").TypeParameters[0].Language["csharp.nullableReferenceConstraint"]);
        Assert.Empty(Of("GenericClassWithAllowsRefStructConstraint`1"));
        Assert.Equal(true, scan.Main.Type(Generics + "GenericClassWithAllowsRefStructConstraint`1").TypeParameters[0].Language["csharp.allowsRefStruct"]);
        Assert.Equal(["referenceType", "System.IDisposable", "System.IComparable`1[!0]", "parameterlessConstructor"], Of("GenericClassWithMultipleConstraints`1").Select(Describe));
        var dependent = scan.Main.Type(Generics + "GenericClassWithDependentConstraint`2");
        Assert.Empty(dependent.TypeParameters[0].Constraints);
        var dependsOn = Assert.IsType<TypeParameterRef>(Assert.IsType<TypeConstraint>(Assert.Single(dependent.TypeParameters[1].Constraints)).Type);
        Assert.Equal(dependent.Id, dependsOn.Owner);
        Assert.Equal(0, dependsOn.Ordinal);
        Assert.Equal(["System.Collections.Generic.IEnumerable`1[int]"], Of("GenericClassWithGenericTypeConstraint`1").Select(Describe));
        Assert.Equal(["System.Numerics.INumber`1[!0]"], Of("GenericClassWithStaticAbstractConstraint`1").Select(Describe));
        Assert.Empty(scan.Main.Type(Generics + "GenericClassWithOneParameter`1").TypeParameters[0].Language);
    }

    private static string Describe(TypeParameterConstraint constraint) => constraint switch
    {
        TypeConstraint type => type.Type.Canonical,
        ReferenceTypeConstraint => "referenceType",
        ValueTypeConstraint => "valueType",
        NotNullConstraint => "notNull",
        ParameterlessConstructorConstraint => "parameterlessConstructor",
        OtherConstraint other => "other:" + other.Text,
        _ => constraint.ToString()!,
    };

    [Fact]
    public void StaticAbstractMembersThroughAConstraintAreUsedOnTheTypeParameter()
    {
        const string Owner = "CSharpSyntax.Generics.GenericClassWithStaticAbstractConstraint`1";
        var zero = Assert.Single(scan.Main.Accesses("csharp:R:" + Owner + ".Zero"));
        Assert.StartsWith("csharp:R:System.Numerics.", zero.To.Value);
        Assert.EndsWith(".Zero", zero.To.Value);
        Assert.Equal(ExpressionKind.TypeParameter, zero.Receiver);
        Assert.Equal(AccessKind.Read, zero.Access);
        Assert.Empty(scan.Main.Invokes("csharp:M:" + Owner + "#Sum(!0,!0)"));
    }

    [Fact]
    public void GenericMethodsNameTheirParametersWithTwoBangs()
    {
        const string Methods = "CSharpSyntax.Generics.GenericMethods#";
        var one = scan.Main.Method(Methods + "GenericMethodWithOneParameter`1(!!0)");
        var parameter = Assert.Single(one.TypeParameters);
        Assert.Equal(("T", 0), (parameter.Name, parameter.Ordinal));
        var returned = Assert.IsType<TypeParameterRef>(one.Signature.ReturnType);
        Assert.Equal(one.Id, returned.Owner);
        Assert.Equal(0, returned.Ordinal);
        Assert.False(returned.Nullable);
        scan.Main.Method(Methods + "GenericMethodWithTwoParameters`2(!!0,System.Func`2[!!0,!!1])");
        scan.Main.Method(Methods + "GenericMethodWithoutUsingParameterInSignature`1()");
        Assert.IsType<ReferenceTypeConstraint>(Assert.Single(scan.Main.Method(Methods + "GenericMethodWithClassConstraint`1(!!0)").TypeParameters[0].Constraints));
        Assert.Equal(["referenceType", "System.IComparable`1[!!0]", "parameterlessConstructor"], scan.Main.Method(Methods + "GenericMethodWithMultipleConstraints`1(!!0)").TypeParameters[0].Constraints.Select(Describe));
        Expect.TypeRef("!!0?", scan.Main.Method(Methods + "GenericMethodWithNullableReturn`1(!!0)").Signature.ReturnType);
        Expect.TypeRef("System.Nullable`1[!!0]", scan.Main.Method(Methods + "GenericMethodReturningNullableValueType`1(!!0)").Signature.ReturnType);
        Assert.True(Assert.Single(scan.Main.Method(Methods + "GenericMethodWithArrayReturn`1(!!0[])").Signature.Parameters).Variadic);
        Expect.TypeRef("(!!0,!!1)", scan.Main.Method(Methods + "GenericMethodWithTupleReturn`2(!!0,!!1)").Signature.ReturnType);
        Assert.Equal(Passing.Ref, scan.Main.Method(Methods + "GenericMethodWithRefReturn`1(!!0[])").Signature.ReturnPassing);
        Assert.Equal(true, scan.Main.Method(Methods + "GenericMethodWithUnmanagedConstraint`1(System.Span`1[!!0])").TypeParameters[0].Language["csharp.unmanaged"]);
        Assert.Equal(true, scan.Main.Method(Methods + "GenericMethodWithAllowsRefStruct`1(!!0)").TypeParameters[0].Language["csharp.allowsRefStruct"]);
        Expect.Modifiers(scan.Main.Method(Methods + "StaticGenericMethod`1(!!0)").Modifiers, Modifier.Static);
        Expect.Modifiers(scan.Main.Method(Methods + "AsyncGenericMethod`1(!!0)").Modifiers, Modifier.Async);
        Assert.Empty(scan.Main.Invokes("csharp:M:" + Methods + "GenericMethodWithLocalGenericFunction`1(!!0)"));
    }

    [Fact]
    public void ClassAndMethodParametersAreToldApartInOneSignature()
    {
        const string Owner = "CSharpSyntax.Generics.GenericClassWithGenericMethods`1";
        var mixing = scan.Main.Method(Owner + "#MethodMixingClassAndMethodParameters`1(!!0)");
        var tuple = Assert.IsType<TupleTypeRef>(mixing.Signature.ReturnType);
        Assert.Equal("(!0?,!!0)", tuple.Canonical);
        Assert.Equal("csharp:T:" + Owner, Assert.IsType<TypeParameterRef>(tuple.Elements[0].Type).Owner.Value);
        Assert.Equal(mixing.Id, Assert.IsType<TypeParameterRef>(tuple.Elements[1].Type).Owner);
        var constrained = scan.Main.Method(Owner + "#MethodWithConstraintReferencingClassParameter`1(!!0)");
        Assert.Equal("!0", Assert.IsType<TypeConstraint>(Assert.Single(constrained.TypeParameters[0].Constraints)).Type.Canonical);
    }

    [Fact]
    public void GenericOverridesAndInterfaceMethods()
    {
        Assert.Equal(["csharp:M:CSharpSyntax.Generics.GenericVirtualMethods#VirtualGenericMethod`1(!!0)"], scan.Main.OverridesOf("csharp:M:CSharpSyntax.Generics.GenericVirtualMethodsOverridden#VirtualGenericMethod`1(!!0)"));
        Expect.One(scan.Main.Invokes("csharp:M:CSharpSyntax.Generics.GenericVirtualMethodsOverridden#VirtualGenericMethod`1(!!0)"), edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericVirtualMethods#VirtualGenericMethod`1(!!0)" && edge.Receiver == ExpressionKind.Base && edge.TypeArguments.Single().Canonical == "!!0", "base call with the own parameter as argument");
        var implementation = Assert.Single(scan.Main.ImplementsMembersOf("csharp:M:CSharpSyntax.Generics.GenericMethodsInInterfaceImplementation#StaticAbstractGenericMethod`1(!!0)"));
        Assert.Equal("csharp:M:CSharpSyntax.Generics.IGenericMethodsInInterface#StaticAbstractGenericMethod`1(!!0)", implementation.To.Value);
    }

    [Fact]
    public void GenericInvocationsCarryTheirTypeArguments()
    {
        const string From = "csharp:M:CSharpSyntax.Generics.GenericMethodInvocations#InvokeWithInferredAndExplicitTypeArguments()";
        var invokes = scan.Main.Invokes(From).ToList();
        Assert.Equal(2, invokes.Count(edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericMethods#GenericMethodWithOneParameter`1(!!0)" && edge.TypeArguments.Single().Canonical == "int" && edge.Receiver == ExpressionKind.Local));
        Assert.Equal(2, invokes.Count(edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericMethods#GenericMethodWithTwoParameters`2(!!0,System.Func`2[!!0,!!1])" && string.Join(",", edge.TypeArguments.Select(t => t.Canonical)) == "int,string"));
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericMethods#GenericMethodWithoutUsingParameterInSignature`1()" && edge.TypeArguments.Single().Canonical == "string", "explicit-only type argument");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericMethods#StaticGenericMethod`1(!!0)" && edge.Receiver == ExpressionKind.Type && edge.TypeArguments.Single().Canonical == "int", "static generic call");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericStaticClass`1#Identity(!0)" && edge.Receiver == ExpressionKind.Type && edge.TypeArguments.Count == 0, "method of a constructed generic class: the definition is the target, no method type arguments");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericExtensionMethods#ClassicGenericExtensionMethod`1(!!0)" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Literal && edge.TypeArguments.Single().Canonical == "int", "classic generic extension inferred from the receiver");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericExtensionMethods#ExtensionMemberSwap`2()" && edge.InvocationKind == InvocationKind.Extension && string.Join(",", edge.TypeArguments.Select(t => t.Canonical)) == "int,string", "extension block member with the block's parameters as type arguments");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericExtensionMethods#ExtensionMemberMap`2(System.Func`2[!!0,!!1])" && edge.InvocationKind == InvocationKind.Extension && string.Join(",", edge.TypeArguments.Select(t => t.Canonical)) == "int,string" && edge.Receiver == ExpressionKind.Creation, "extension block member with block and own type arguments");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Generics.GenericClassWithOneParameter`1+NestedGenericClass`1#.ctor()" && edge.TypeArguments.Count == 0 && edge.Receiver is null, "constructor of a nested constructed type");
        Expect.One(scan.Main.UsesTypes(From), edge => edge.Role == TypeUseRole.Creation && edge.To.Canonical == "CSharpSyntax.Generics.GenericClassWithOneParameter`1+NestedGenericClass`1[int,string]", "creation of the constructed nested type");
        Expect.One(scan.Main.Accesses(From), edge => edge.To.Value == "csharp:R:CSharpSyntax.Generics.GenericExtensionMethods.ExtensionMemberIsEmpty" && edge.Receiver == ExpressionKind.Creation, "extension block property on a new list");
    }
}
