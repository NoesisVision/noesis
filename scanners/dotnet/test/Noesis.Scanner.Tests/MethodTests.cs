using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class MethodTests(FixtureScan scan)
{
    private const string Methods = "CSharpSyntax.Methods.MethodDeclarations#";
    private const string Returns = "CSharpSyntax.Methods.ReturnTypes#";
    private const string Parameters = "CSharpSyntax.Methods.ParameterKinds#";
    private const string Operators = "CSharpSyntax.Methods.OperatorDeclarations#";

    [Theory]
    [InlineData("PublicMethod()", Visibility.Public)]
    [InlineData("PrivateMethod()", Visibility.Private)]
    [InlineData("InternalMethod()", Visibility.Artifact)]
    [InlineData("ProtectedMethod()", Visibility.Protected)]
    [InlineData("ProtectedInternalMethod()", Visibility.ProtectedOrArtifact)]
    [InlineData("PrivateProtectedMethod()", Visibility.ProtectedAndArtifact)]
    [InlineData("MethodWithoutAccessModifier()", Visibility.Private)]
    public void MethodVisibility(string method, Visibility expected) => Assert.Equal(expected, scan.Main.Method(Methods + method).Visibility);

    [Fact]
    public void MethodKindsModifiersAndSpecialNames()
    {
        var plain = scan.Main.Method(Methods + "PublicMethod()");
        Assert.Equal(MethodKind.Method, plain.MethodKind);
        Assert.Equal("PublicMethod", plain.Name);
        Assert.False(plain.Bodiless);
        Assert.Null(plain.ExtensionReceiver);
        Expect.TypeRef("void", plain.Signature.ReturnType);
        Expect.Modifiers(scan.Main.Method(Methods + "StaticMethod()").Modifiers, Modifier.Static);
        var external = scan.Main.Method(Methods + "ExternMethod()");
        Expect.Modifiers(external.Modifiers, Modifier.Static, Modifier.External);
        Assert.True(external.Bodiless);
        Assert.Equal("namespace", scan.Main.Method(Methods + "namespace()").Name);
        Expect.Modifiers(scan.Main.Method(Methods + "ToString()").Modifiers, Modifier.Hiding);
        Expect.Modifiers(scan.Main.Method(Methods + "MethodHidingNothingDeclaredWithNew()").Modifiers);
        Assert.Equal(true, scan.Main.Method(Methods + "UnsafeMethod(int*)").Bag("csharp.unsafe"));
        Assert.Equal(Origin.Declared, plain.Origin);
        Assert.Equal("scanners/dotnet/test/fixtures/CSharpSyntax/Methods/MethodDeclarations.cs", Assert.Single(plain.Locations).File);
        Assert.True(scan.Main.Contains("T:CSharpSyntax.Methods.MethodDeclarations", plain.Id.Value));
    }

    [Fact]
    public void ConstructorsStaticConstructorAndFinalizer()
    {
        Assert.Equal(MethodKind.Constructor, scan.Main.Method(Methods + ".ctor()").MethodKind);
        Assert.Equal(".ctor", scan.Main.Method(Methods + ".ctor(int)").Name);
        Expect.One(scan.Main.Invokes("M:" + Methods + ".ctor(int,bool)"), edge => edge.To.Value == "M:" + Methods + ".ctor(int)" && edge.Receiver == ExpressionKind.This && edge.InvocationKind == InvocationKind.Call, "this(...) chaining");
        var staticConstructor = scan.Main.Method(Methods + ".cctor()");
        Assert.Equal(MethodKind.StaticInitializer, staticConstructor.MethodKind);
        Expect.Modifiers(staticConstructor.Modifiers, Modifier.Static);
        var finalizer = scan.Main.Method(Methods + "Finalize()");
        Assert.Equal(MethodKind.Destructor, finalizer.MethodKind);
        Expect.One(scan.Main.Accesses(finalizer.Id.Value), edge => edge.To.Value == "F:CSharpSyntax.Methods.MethodDeclarations._field" && edge.Access == AccessKind.Write, "field write in finalizer");
    }

    [Fact]
    public void AttributesOnMethodsReturnsAndParameters()
    {
        var dllImport = Assert.Single(scan.Main.Method(Methods + "ExternMethod()").Annotations);
        Assert.Equal("System.Runtime.InteropServices.DllImportAttribute", dllImport.Type.Canonical);
        Assert.Equal(["dllName", "EntryPoint"], dllImport.Arguments.Select(argument => argument.Name));
        Assert.Equal("\"libc\"", Assert.IsType<LiteralAnnotationValue>(dllImport.Arguments[0].Value).Text);
        var methodImpl = Assert.Single(scan.Main.Method(Methods + "MethodWithAttribute()").Annotations);
        var options = Assert.IsType<EnumAnnotationValue>(Assert.Single(methodImpl.Arguments).Value);
        Assert.Equal("System.Runtime.CompilerServices.MethodImplOptions", options.Type.Canonical);
        Assert.Equal("NoInlining", options.Member);
        Assert.Contains(scan.Main.AnnotationsOf("M:" + Methods + "MethodWithAttribute()"), annotation => annotation.Type.Canonical == "System.Runtime.CompilerServices.MethodImplAttribute");

        var withReturnAttribute = scan.Main.Method(Methods + "MethodWithReturnAttribute()");
        Assert.Equal("System.Diagnostics.CodeAnalysis.NotNullAttribute", Assert.Single(withReturnAttribute.Signature.ReturnAnnotations).Type.Canonical);
        Expect.TypeRef("string?", withReturnAttribute.Signature.ReturnType);
        Assert.Empty(withReturnAttribute.Annotations);
        var parameter = scan.Main.Method(Methods + "MethodWithParameterAttribute(string)").Parameter("parameter");
        Assert.Equal("System.Diagnostics.CodeAnalysis.NotNullAttribute", Assert.Single(parameter.Annotations).Type.Canonical);
        var callerInfo = scan.Main.Method(Methods + "MethodWithCallerInfoDefaults(string,string,int,string)");
        Assert.Equal(["\"\"", "\"\"", "0", "\"\""], callerInfo.Signature.Parameters.Select(p => p.DefaultValue));
        Assert.All(callerInfo.Signature.Parameters, p => Assert.True(p.Optional));
        Assert.Equal("System.Runtime.CompilerServices.CallerMemberNameAttribute", Assert.Single(callerInfo.Parameter("member").Annotations).Type.Canonical);
    }

    [Theory]
    [InlineData("VoidReturn()", "void")]
    [InlineData("PrimitiveReturn()", "int")]
    [InlineData("NullableValueReturn()", "System.Nullable`1[int]")]
    [InlineData("NullableReferenceReturn()", "string?")]
    [InlineData("MultiDimensionalArrayReturn()", "int[,]")]
    [InlineData("NamedTupleReturn()", "(int,string)")]
    [InlineData("NestedGenericReturn()", "System.Collections.Generic.Dictionary`2[string,System.Collections.Generic.List`1[int]]")]
    [InlineData("DynamicReturn()", "dynamic")]
    [InlineData("SelfTypeReturn()", "CSharpSyntax.Methods.ReturnTypes")]
    [InlineData("NestedTypeReturn()", "CSharpSyntax.Methods.ReturnTypes+NestedTypeForReturn")]
    [InlineData("GenericTaskReturn()", "System.Threading.Tasks.Task`1[int]")]
    [InlineData("PointerReturn()", "int*")]
    [InlineData("FunctionPointerReturn()", "delegate*<int,int>")]
    [InlineData("EnumReturn()", "CSharpSyntax.Methods.PlainEnumForMethods")]
    [InlineData("IteratorReturn()", "System.Collections.Generic.IEnumerable`1[int]")]
    [InlineData("AsyncIteratorReturn(System.Threading.CancellationToken)", "System.Collections.Generic.IAsyncEnumerable`1[int]")]
    [InlineData("AsyncVoidReturn()", "void")]
    public void ReturnTypes(string method, string canonical) => Expect.TypeRef(canonical, scan.Main.Method(Returns + method).Signature.ReturnType);

    [Fact]
    public void RefReturnsAndAsyncMethods()
    {
        Assert.Equal(Passing.Ref, scan.Main.Method(Returns + "RefReturn()").Signature.ReturnPassing);
        Assert.Null(scan.Main.Method(Returns + "RefReturn()").Bag("csharp.readonlyRef"));
        Assert.Equal(Passing.Ref, scan.Main.Method(Returns + "RefReadonlyReturn()").Signature.ReturnPassing);
        Assert.Equal(true, scan.Main.Method(Returns + "RefReadonlyReturn()").Bag("csharp.readonlyRef"));
        Assert.Equal(Passing.Value, scan.Main.Method(Returns + "PrimitiveReturn()").Signature.ReturnPassing);
        Expect.Modifiers(scan.Main.Method(Returns + "AsyncTaskReturn()").Modifiers, Modifier.Async);
        Expect.Modifiers(scan.Main.Method(Returns + "AsyncVoidReturn()").Modifiers, Modifier.Async);
        Expect.Modifiers(scan.Main.Method(Returns + "IteratorReturn()").Modifiers);
        Assert.Equal(["System.Runtime.CompilerServices.EnumeratorCancellationAttribute"], scan.Main.Method(Returns + "AsyncIteratorReturn(System.Threading.CancellationToken)").Signature.Parameters[0].Annotations.Select(a => a.Type.Canonical));
    }

    [Fact]
    public void ParameterPassingKinds()
    {
        var byRef = Assert.Single(scan.Main.Method(Parameters + "RefParameter(int)").Signature.Parameters);
        Assert.Equal(Passing.Ref, byRef.Passing);
        Assert.Null(byRef.Bag("csharp.refKind"));
        Assert.Equal("out", Assert.Single(scan.Main.Method(Parameters + "OutParameter(int)").Signature.Parameters).Bag("csharp.refKind"));
        Assert.Equal("in", Assert.Single(scan.Main.Method(Parameters + "InParameter(int)").Signature.Parameters).Bag("csharp.refKind"));
        Assert.Equal("refReadonly", Assert.Single(scan.Main.Method(Parameters + "RefReadonlyParameter(int)").Signature.Parameters).Bag("csharp.refKind"));
        Assert.Equal(Passing.Value, Assert.Single(scan.Main.Method(Parameters + "SingleParameter(int)").Signature.Parameters).Passing);
        var multiple = scan.Main.Method(Parameters + "MultipleRefKinds(int,int,int,int)");
        Assert.Equal([Passing.Ref, Passing.Ref, Passing.Ref, Passing.Ref], multiple.Signature.Parameters.Select(p => p.Passing));
        Assert.Equal([null, "out", "in", "refReadonly"], multiple.Signature.Parameters.Select(p => p.Bag("csharp.refKind")));
        Assert.Equal(true, Assert.Single(scan.Main.Method(Parameters + "ScopedParameter(System.ReadOnlySpan`1[int])").Signature.Parameters).Bag("csharp.scoped"));
        Assert.Equal(true, Assert.Single(scan.Main.Method(Parameters + "ScopedRefParameter(int)").Signature.Parameters).Bag("csharp.scoped"));
        Assert.Null(byRef.Bag("csharp.scoped"));
    }

    [Fact]
    public void OptionalAndVariadicParameters()
    {
        var optional = scan.Main.Method(Parameters + "OptionalParameters(int,string,object,CSharpSyntax.Methods.PlainEnumForMethods,System.Nullable`1[int])");
        Assert.Equal(["value", "text", "reference", "enumValue", "nullable"], optional.Signature.Parameters.Select(p => p.Name));
        Assert.All(optional.Signature.Parameters, p => Assert.True(p.Optional));
        Assert.Equal(["1", "\"default\"", "null", "PlainEnumForMethods.Member", "null"], optional.Signature.Parameters.Select(p => p.DefaultValue));
        Expect.TypeRef("object?", optional.Parameter("reference").Type);
        Assert.Equal("default", Assert.Single(scan.Main.Method(Parameters + "OptionalParameterWithDefaultLiteral(System.Threading.CancellationToken)").Signature.Parameters).DefaultValue);
        Assert.Equal("1 + 2", Assert.Single(scan.Main.Method(Parameters + "OptionalParameterWithConstExpression(int)").Signature.Parameters).DefaultValue);
        Assert.Equal("ConstDefault", Assert.Single(scan.Main.Method(Parameters + "ParameterWithDefaultFromConst(int)").Signature.Parameters).DefaultValue);
        Assert.False(Assert.Single(scan.Main.Method(Parameters + "SingleParameter(int)").Signature.Parameters).Optional);
        Assert.Null(Assert.Single(scan.Main.Method(Parameters + "SingleParameter(int)").Signature.Parameters).DefaultValue);

        var paramsArray = Assert.Single(scan.Main.Method(Parameters + "ParamsArrayParameter(int[])").Signature.Parameters);
        Assert.True(paramsArray.Variadic);
        Expect.TypeRef("int[]", paramsArray.Type);
        Assert.True(Assert.Single(scan.Main.Method(Parameters + "ParamsSpanParameter(System.ReadOnlySpan`1[int])").Signature.Parameters).Variadic);
        Assert.True(Assert.Single(scan.Main.Method(Parameters + "ParamsCollectionParameter(System.Collections.Generic.IEnumerable`1[int])").Signature.Parameters).Variadic);
        Assert.Equal([false, true], scan.Main.Method(Parameters + "ParamsAfterRegularParameters(string,object[])").Signature.Parameters.Select(p => p.Variadic));
        var attributed = Assert.Single(scan.Main.Method(Parameters + "ParameterWithAttribute(int)").Signature.Parameters);
        Assert.True(attributed.Optional);
        Assert.Null(attributed.DefaultValue);
        Assert.Equal("System.Runtime.InteropServices.OptionalAttribute", Assert.Single(attributed.Annotations).Type.Canonical);
        Assert.Equal(["class", "event"], scan.Main.Method(Parameters + "ParameterNamedWithVerbatimIdentifier(int,string)").Signature.Parameters.Select(p => p.Name));
    }

    [Theory]
    [InlineData("NullableParameters(System.Nullable`1[int],string)", "System.Nullable`1[int]", "string?")]
    [InlineData("ArrayParameters(int[],int[,],int[][])", "int[]", "int[,]", "int[][]")]
    [InlineData("TupleParameters((int,string),(int,string))", "(int,string)", "(int,string)")]
    [InlineData("DelegateParameters(System.Action,System.Func`2[int,int],System.Predicate`1[int],System.EventHandler)", "System.Action", "System.Func`2[int,int]", "System.Predicate`1[int]", "System.EventHandler")]
    [InlineData("DynamicParameter(dynamic)", "dynamic")]
    [InlineData("PointerParameters(int*,void*,delegate*<int,int>)", "int*", "void*", "delegate*<int,int>")]
    [InlineData("NestedTypeParameter(CSharpSyntax.Methods.ReturnTypes+NestedTypeForReturn)", "CSharpSyntax.Methods.ReturnTypes+NestedTypeForReturn")]
    [InlineData("InStructParameter(CSharpSyntax.Methods.StructForMethods)", "CSharpSyntax.Methods.StructForMethods")]
    [InlineData("RefParameterWithNullable(string)", "string?")]
    public void ParameterTypesAreCanonicalInIdsAndNullableOnTheNode(string method, params string[] canonical) =>
        Assert.Equal(canonical, scan.Main.Method(Parameters + method).Signature.Parameters.Select(p => p.Type.Canonical));

    [Fact]
    public void VirtualAbstractSealedAndHidingMethods()
    {
        const string Base = "CSharpSyntax.Methods.MethodModifiers#";
        const string Derived = "CSharpSyntax.Methods.MethodModifiersDerived#";
        var abstractMethod = scan.Main.Method(Base + "AbstractMethod()");
        Expect.Modifiers(abstractMethod.Modifiers, Modifier.Abstract);
        Assert.True(abstractMethod.Bodiless);
        Expect.Modifiers(scan.Main.Method(Base + "VirtualMethod()").Modifiers, Modifier.Virtual);
        Assert.False(scan.Main.Method(Base + "VirtualMethod()").Bodiless);
        Expect.Modifiers(scan.Main.Method(Derived + "AbstractMethod()").Modifiers, Modifier.Virtual);
        Expect.Modifiers(scan.Main.Method(Derived + "VirtualMethodToSeal()").Modifiers, Modifier.Final);
        Expect.Modifiers(scan.Main.Method(Derived + "NonVirtualMethodToHide()").Modifiers, Modifier.Hiding);
        Assert.Equal(["M:" + Base + "AbstractMethod()"], scan.Main.OverridesOf("M:" + Derived + "AbstractMethod()"));
        Assert.Equal(["M:" + Base + "VirtualMethodToSeal()"], scan.Main.OverridesOf("M:" + Derived + "VirtualMethodToSeal()"));
        Assert.Empty(scan.Main.OverridesOf("M:" + Derived + "NonVirtualMethodToHide()"));
        Expect.One(scan.Main.Invokes("M:" + Derived + "VirtualMethod()"), edge => edge.To.Value == "M:" + Base + "VirtualMethod()" && edge.Receiver == ExpressionKind.Base, "base call");
        Assert.Equal(["M:" + Base + "AbstractGenericMethod`1(!!0)"], scan.Main.OverridesOf("M:" + Derived + "AbstractGenericMethod`1(!!0)"));
    }

    [Fact]
    public void InterfaceStructStaticAndRecordMethods()
    {
        const string Interface = "CSharpSyntax.Methods.IMethodsInInterface#";
        Assert.True(scan.Main.Method(Interface + "AbstractMethodInInterface()").Bodiless);
        Assert.False(scan.Main.Method(Interface + "DefaultMethodInInterface()").Bodiless);
        Expect.Modifiers(scan.Main.Method(Interface + "StaticAbstractMethodInInterface()").Modifiers, Modifier.Static, Modifier.Abstract);
        Expect.Modifiers(scan.Main.Method(Interface + "StaticVirtualMethodInInterface()").Modifiers, Modifier.Static, Modifier.Virtual);
        Assert.True(scan.Main.Method(Interface + "GenericMethodInInterface`1(!!0)").Bodiless);
        Assert.Equal(true, scan.Main.Method("CSharpSyntax.Methods.MethodsInStruct#ReadonlyMethod()").Bag("csharp.readonlyMember"));
        Assert.Null(scan.Main.Method("CSharpSyntax.Methods.MethodsInStruct#MutatingMethod()").Bag("csharp.readonlyMember"));
        Expect.Modifiers(scan.Main.Method("CSharpSyntax.Methods.StaticClassMethods#StaticMethodInStaticClass()").Modifiers, Modifier.Static);
        Expect.One(scan.Main.Invokes("M:CSharpSyntax.Methods.MethodsInRecord#StaticMethodInRecord()"), edge => edge.To.Value == "M:CSharpSyntax.Methods.MethodsInRecord#.ctor(int)", "record creation");
        Expect.One(scan.Main.Accesses("M:CSharpSyntax.Methods.MethodsInRecord#MethodInRecord()"), edge => edge.To.Value == "P:CSharpSyntax.Methods.MethodsInRecord.Value" && edge.Receiver == ExpressionKind.This, "positional property read");
    }

    [Fact]
    public void PartialMethodsAreOneNodeEach()
    {
        const string Partial = "CSharpSyntax.Methods.PartialMethods#";
        var withoutImplementation = scan.Main.Method(Partial + "ClassicPartialMethodWithoutImplementation()");
        Assert.True(withoutImplementation.Bodiless);
        Assert.Equal(true, withoutImplementation.Bag("csharp.partial"));
        Assert.Equal(Visibility.Private, withoutImplementation.Visibility);
        Assert.Single(withoutImplementation.Locations);
        var withImplementation = scan.Main.Method(Partial + "ClassicPartialMethodWithImplementation()");
        Assert.False(withImplementation.Bodiless);
        Assert.Equal(2, withImplementation.Locations.Count);
        Assert.Equal(2, scan.Main.Method(Partial + "ExtendedPartialMethod(int)").Locations.Count);
        Assert.Equal(2, scan.Main.Method(Partial + ".ctor()").Locations.Count);
        Assert.Equal(2, scan.Main.Method(Partial + "CreateViaPartialStaticMethod()").Locations.Count);
        Expect.One(scan.Main.Invokes("M:" + Partial + "CreateViaPartialStaticMethod()"), edge => edge.To.Value == "M:" + Partial + ".ctor()", "creation in the implementation part");
        Assert.Equal(2, scan.Main.Nodes.Count(node => node.Id.Value.StartsWith("M:" + Partial + "Classic", StringComparison.Ordinal)));
    }

    [Fact]
    public void OperatorsUseClrNamesAndConversionsAppendTheirTarget()
    {
        var addition = scan.Main.Method(Operators + "op_Addition(CSharpSyntax.Methods.OperatorDeclarations,CSharpSyntax.Methods.OperatorDeclarations)");
        Assert.Equal(MethodKind.Operator, addition.MethodKind);
        Assert.Equal("op_Addition", addition.Name);
        Expect.Modifiers(addition.Modifiers, Modifier.Static);
        Assert.Null(addition.Bag("csharp.conversion"));
        scan.Main.Method(Operators + "op_Addition(CSharpSyntax.Methods.OperatorDeclarations,int)");
        scan.Main.Method(Operators + "op_Addition(int,CSharpSyntax.Methods.OperatorDeclarations)");
        scan.Main.Method(Operators + "op_CheckedAddition(CSharpSyntax.Methods.OperatorDeclarations,CSharpSyntax.Methods.OperatorDeclarations)");
        scan.Main.Method(Operators + "op_UnsignedRightShift(CSharpSyntax.Methods.OperatorDeclarations,int)");
        scan.Main.Method(Operators + "op_UnaryNegation(CSharpSyntax.Methods.OperatorDeclarations)");
        scan.Main.Method(Operators + "op_True(CSharpSyntax.Methods.OperatorDeclarations)");
        scan.Main.Method(Operators + "op_Equality(CSharpSyntax.Methods.OperatorDeclarations,CSharpSyntax.Methods.OperatorDeclarations)");
        scan.Main.Method(Operators + "op_CheckedIncrement(CSharpSyntax.Methods.OperatorDeclarations)");

        var implicitConversion = scan.Main.Method(Operators + "op_Implicit(int):CSharpSyntax.Methods.OperatorDeclarations");
        Assert.Equal(MethodKind.Operator, implicitConversion.MethodKind);
        Assert.Equal("implicit", implicitConversion.Bag("csharp.conversion"));
        Assert.Equal("explicit", scan.Main.Method(Operators + "op_Explicit(CSharpSyntax.Methods.OperatorDeclarations):int").Bag("csharp.conversion"));
        Assert.Equal("explicit", scan.Main.Method(Operators + "op_CheckedExplicit(CSharpSyntax.Methods.OperatorDeclarations):byte").Bag("csharp.conversion"));
        scan.Main.Method(Operators + "op_Explicit(CSharpSyntax.Methods.OperatorDeclarations):byte");
        scan.Main.Method(Operators + "op_Implicit(CSharpSyntax.Methods.OperatorDeclarations):string");

        const string Compound = "CSharpSyntax.Methods.CompoundAssignmentOperatorDeclarations#";
        var compound = scan.Main.Method(Compound + "op_AdditionAssignment(int)");
        Assert.Equal(MethodKind.Operator, compound.MethodKind);
        Expect.Modifiers(compound.Modifiers);
        scan.Main.Method(Compound + "op_IncrementAssignment()");
        scan.Main.Method(Compound + "op_CheckedAdditionAssignment(int)");
        Expect.Modifiers(scan.Main.Method("CSharpSyntax.Methods.IOperatorsInInterface`1#op_Addition(!0,!0)").Modifiers, Modifier.Static, Modifier.Abstract);
        Expect.Modifiers(scan.Main.Method("CSharpSyntax.Methods.IOperatorsInInterface`1#op_Subtraction(!0,!0)").Modifiers, Modifier.Static, Modifier.Virtual);
        scan.Main.Method("CSharpSyntax.Methods.IOperatorsInInterface`1#op_Explicit(!0):int");
    }

    [Fact]
    public void LocalFunctionsAndLambdasAreNotNodesAndTheirBodiesAttributeToTheMember()
    {
        const string Owner = "CSharpSyntax.Methods.LocalFunctionsAndLambdas#";
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Id.Value.StartsWith("M:" + Owner, StringComparison.Ordinal) && node.Name.Contains("LocalFunction") && !node.Name.StartsWith("MethodWith", StringComparison.Ordinal));
        var withLocals = "M:" + Owner + "MethodWithLocalFunctions(int)";
        Assert.DoesNotContain(scan.Main.Invokes(withLocals), edge => edge.To.Value.Contains("LocalFunction"));
        Expect.One(scan.Main.Invokes(withLocals), edge => edge.To.Value.StartsWith("M:System.Linq.Enumerable#Sum", StringComparison.Ordinal) && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.ReturnValue, "Sum over the iterator local function (a call to a local function denotes 'returnValue')");
        Expect.One(scan.Main.Invokes(withLocals), edge => edge.To.Value == "M:System.Threading.Tasks.Task#Yield()" && edge.Site.ViaClosure, "Task.Yield inside the async local function");
        Expect.One(scan.Main.Accesses(withLocals), edge => edge.To.Value == "F:CSharpSyntax.Methods.LocalFunctionsAndLambdas._field" && edge.Site.ViaClosure, "field read in a local function");
        Expect.One(scan.Main.Accesses(withLocals), edge => edge.To.Value == "P:System.Threading.Tasks.Task`1.Result" && !edge.Site.ViaClosure, "Result read outside closures");

        var withLambdas = "M:" + Owner + "MethodWithLambdas()";
        Expect.One(scan.Main.Accesses(withLambdas), edge => edge.To.Value == "F:CSharpSyntax.Methods.LocalFunctionsAndLambdas._field" && edge.Site.ViaClosure, "field captured in a lambda");
        Expect.One(scan.Main.Invokes(withLambdas), edge => edge.To.Value == "M:System.Threading.Tasks.Task#Yield()" && edge.Site.ViaClosure, "await inside an async lambda");
        Assert.DoesNotContain(scan.Main.Invokes(withLambdas), edge => edge.To.Value.EndsWith("#Invoke()", StringComparison.Ordinal) || edge.To.Value.EndsWith("#Invoke(int)", StringComparison.Ordinal));
        Assert.DoesNotContain(scan.Main.Invokes(withLambdas), edge => edge.To.Value.Contains("StaticTarget"));
        Assert.Empty(scan.Main.AnnotationsOf(withLambdas));
    }
}
