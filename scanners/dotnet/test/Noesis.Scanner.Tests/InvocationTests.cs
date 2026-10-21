using Noesis.Scanner.Model;
using Noesis.Scanner.Tests.Infrastructure;

namespace Noesis.Scanner.Tests;

public class InvocationTests(FixtureScan scan)
{
    private const string Forms = "csharp:M:CSharpSyntax.Invocations.InvocationForms#AllInvocationForms()";
    private const string Target = "CSharpSyntax.Invocations.InvocationTarget";
    private const string Extensions = "CSharpSyntax.Invocations.InvocationExtensions";

    private List<InvokesEdge> Invokes => scan.Main.Invokes(Forms).ToList();
    private List<AccessesEdge> Accesses => scan.Main.Accesses(Forms).ToList();

    private static Func<InvokesEdge, bool> To(string id, ExpressionKind? receiver) => edge => edge.To.Value == id && edge.Receiver == receiver;

    [Fact]
    public void StaticCallsHaveATypeReceiverHoweverTheTypeIsSpelt()
    {
        Assert.True(Invokes.Count(To("csharp:M:" + Target + "#StaticMethod()", ExpressionKind.Type)) >= 5);
        Assert.All(Invokes.Where(edge => edge.To.Value == "csharp:M:" + Target + "#StaticMethod()"), edge => Assert.Equal(InvocationKind.Call, edge.InvocationKind));
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Target + "#StaticGenericMethod`1(!!0)" && edge.TypeArguments.Single().Canonical == "int", "inferred static generic");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Target + "#StaticGenericMethod`1(!!0)" && edge.TypeArguments.Single().Canonical == "string", "explicit static generic");
        Expect.One(Invokes, To("csharp:M:" + Target + "+NestedStaticHolder#NestedStaticMethod()", ExpressionKind.Type), "static on a nested type");
        Expect.One(Invokes, To("csharp:M:" + Target + "+NestedStaticHolder+DoublyNested#DoublyNestedStaticMethod()", ExpressionKind.Type), "static on a doubly nested type");
        Assert.Equal(3, Invokes.Count(To("csharp:M:CSharpSyntax.Invocations.InvocationForms#StaticMethodOnThisClass()", ExpressionKind.Type)));
        Assert.Equal(2, Invokes.Count(To("csharp:M:CSharpSyntax.Invocations.InvocationBase#StaticBaseMethod()", ExpressionKind.Type)));
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.IInvocationInterface#StaticInterfaceMethod()", ExpressionKind.Type), "static interface method");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationDerived#StaticAbstractInterfaceMethod()", ExpressionKind.Type), "static abstract implementation called on the class");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.GenericStaticClassForInvocations`1#StaticOnGenericClass()", ExpressionKind.Type), "static on a generic class");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.OtherProject.StaticClassFromOtherProject#StaticMethodFromOtherProject()", ExpressionKind.Type), "static from the other project");
        Expect.One(Invokes, To("csharp:M:System.Math#Max(int,int)", ExpressionKind.Type), "framework static");
        Expect.One(Invokes, To("csharp:M:System.Int32#Parse(string)", ExpressionKind.Type), "static on a keyword type");
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.String#Join", StringComparison.Ordinal) && edge.Receiver == ExpressionKind.Type, "string.Join");
        var viaTypeParameter = Assert.Single(scan.Main.Invokes("csharp:M:CSharpSyntax.Invocations.InvocationForms#CallStaticAbstractViaTypeParameter`1()"));
        Assert.Equal(("csharp:M:CSharpSyntax.Invocations.IInvocationInterface#StaticAbstractInterfaceMethod()", ExpressionKind.TypeParameter), (viaTypeParameter.To.Value, viaTypeParameter.Receiver));
    }

    [Fact]
    public void InstanceReceiversAreClassifiedByWhatTheySpell()
    {
        const string Instance = "csharp:M:" + Target + "#InstanceMethod()";
        Assert.Equal(3, Invokes.Count(To("csharp:M:CSharpSyntax.Invocations.InvocationForms#InstanceMethodOnThisClass()", ExpressionKind.This)));
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationBase#VirtualMethod()", ExpressionKind.Base), "base.VirtualMethod()");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationBase#VirtualMethod()", ExpressionKind.This), "VirtualMethod() via implicit this");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationBase#BaseOnlyMethod()", ExpressionKind.This), "inherited method via implicit this");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationBase#ProtectedBaseMethod()", ExpressionKind.This), "protected inherited method");
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.Local)) >= 3);
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.Field)) >= 4);
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.Property)) >= 6);
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.Creation)) >= 2);
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.ReturnValue)) >= 3);
        Assert.True(Invokes.Count(To(Instance, ExpressionKind.Other)) >= 3);
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.IInvocationInterface#InterfaceMethod()", ExpressionKind.Local), "call through an interface reference");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.IInvocationInterface#DefaultInterfaceMethod()", ExpressionKind.Local), "default interface method");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.IInvocationInterface#DefaultInterfaceMethod()", ExpressionKind.Creation), "default interface method on a cast creation");
        Expect.One(Invokes, To("csharp:M:System.Int32#ToString()", ExpressionKind.Local), "ToString on a value type local");
        Expect.One(Invokes, To("csharp:M:System.Int32#ToString()", ExpressionKind.Literal), "ToString on a literal");
        Expect.One(Invokes, To("csharp:M:System.String#ToUpper()", ExpressionKind.Literal), "ToUpper on a literal");
        Expect.One(Invokes, To("csharp:M:System.Enum#ToString()", ExpressionKind.Field), "ToString on an enum member");
        Expect.One(Invokes, To("csharp:M:System.Object#ToString()", ExpressionKind.This), "inherited object method");
        Expect.One(Invokes, To("csharp:M:" + Target + "#ToString()", ExpressionKind.Local), "overridden ToString on a local");
        Expect.One(Invokes, To("csharp:M:System.Object#GetType()", ExpressionKind.This), "GetType via implicit this");
        Expect.One(Invokes, To("csharp:M:" + Target + "#ReturnsSelf()", ExpressionKind.Local), "ReturnsSelf on a local");
        Expect.One(Invokes, To("csharp:M:" + Target + "#ReturnsSelf()", ExpressionKind.ReturnValue), "ReturnsSelf chained");
        Expect.One(Invokes, To("csharp:M:System.String#ToUpper()", ExpressionKind.Property), "record property receiver");
    }

    [Fact]
    public void NullConditionalCallsAreFlaggedOnTheSite()
    {
        var nullConditional = Invokes.Where(edge => edge.Site.Bag("csharp.nullConditional") is true).ToList();
        Assert.True(nullConditional.Count >= 3);
        Expect.One(nullConditional, To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.Local), "nullableLocal?.InstanceMethod()");
        Expect.One(nullConditional, To("csharp:M:" + Target + "#ReturnsNullableSelf()", ExpressionKind.ReturnValue), "?.ReturnsSelf()?.ReturnsNullableSelf()");
        Assert.All(Invokes.Where(To("csharp:M:" + Target + "#StaticMethod()", ExpressionKind.Type)), edge => Assert.Null(edge.Site.Bag("csharp.nullConditional")));
    }

    [Fact]
    public void ArgumentsDoNotChangeTheTargetAndOverloadsResolve()
    {
        const string WithArguments = "csharp:M:" + Target + "#InstanceMethodWithArguments(int,string,int[])";
        Assert.True(Invokes.Count(edge => edge.To.Value == WithArguments) >= 12);
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#MethodWithOverloads(int)", ExpressionKind.This), "overload by type (int)");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#MethodWithOverloads(string)", ExpressionKind.This), "overload by type (string)");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#MethodWithOverloads(int,int)", ExpressionKind.This), "overload by arity");
        Assert.Equal(3, Invokes.Count(edge => edge.To.Value == "csharp:M:" + Target + "#InstanceMethodWithRefKinds(int,int,int)"));
        Assert.Equal(2, Invokes.Count(edge => edge.To.Value == "csharp:M:" + Target + "#GenericInstanceMethod`1(!!0)" && edge.TypeArguments.Single().Canonical == "int"));
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Target + "#GenericInstanceMethod`1(!!0)" && edge.TypeArguments.Single().Canonical == Target, "type argument inferred from an argument expression");
        Assert.True(Invokes.Count(edge => edge.To.Value == "csharp:M:System.Linq.Enumerable#Select`2(System.Collections.Generic.IEnumerable`1[!!0],System.Func`2[!!0,!!1])") >= 4);
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Linq.Enumerable#Select`2(", StringComparison.Ordinal) && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Field && edge.TypeArguments[0].Canonical == Target && edge.TypeArguments[1].Canonical == "int", "Select over the list field");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Target + "#InstanceMethod()" && edge.Receiver == ExpressionKind.Parameter && edge.Site.ViaClosure, "call inside the Select lambda");
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Array#ConvertAll`2(", StringComparison.Ordinal) && edge.Receiver == ExpressionKind.Type, "Array.ConvertAll");
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Linq.Enumerable#Select`2(", StringComparison.Ordinal) && edge.TypeArguments[1] is StructuralTypeRef, "Select projecting to an anonymous type");
        Expect.One(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Creation && edge.To is StructuralTypeRef structural && structural.Canonical == "{Target:" + Target + ",Value:int}" && edge.Site.ViaClosure, "anonymous object inside the lambda");
    }

    [Fact]
    public void ExtensionCallsAreToldFromStaticCallsBySpelling()
    {
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicExtensionMethod(" + Target + ")" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Local, "instance syntax");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicExtensionMethod(" + Target + ")" && edge.InvocationKind == InvocationKind.Call && edge.Receiver == ExpressionKind.Type, "static syntax");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicGenericExtensionMethod`1(!!0)" && edge.InvocationKind == InvocationKind.Extension && edge.TypeArguments.Single().Canonical == Target, "generic extension with the inferred receiver type");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicExtensionOnInterface(CSharpSyntax.Invocations.IInvocationInterface)" && edge.InvocationKind == InvocationKind.Extension, "extension on an interface");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicExtensionOnNullable(" + Target + ")" && edge.InvocationKind == InvocationKind.Extension, "extension on a nullable receiver, id without the annotation");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ClassicExtensionOnRefStruct(int)" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Local, "this ref extension");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.OtherProject.StaticClassFromOtherProject#ClassicExtensionMethodFromOtherProject(string)" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Literal, "extension from the other project");
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Linq.Enumerable#Where`1(", StringComparison.Ordinal) && edge.InvocationKind == InvocationKind.Extension, "LINQ Where");
        Expect.One(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Linq.Enumerable#ToList`1(", StringComparison.Ordinal) && edge.Receiver == ExpressionKind.ReturnValue, "ToList on the Where result");
        Assert.Equal(1, Invokes.Count(edge => edge.To.Value.StartsWith("csharp:M:System.Linq.Enumerable#Sum(", StringComparison.Ordinal) && edge.Receiver == ExpressionKind.Other));
        var methodNode = scan.Main.Method(Extensions + "#ClassicExtensionMethod(" + Target + ")");
        Expect.TypeRef(Target, methodNode.ExtensionReceiver!);
        Assert.Equal("receiver", Assert.Single(methodNode.Signature.Parameters).Name);
        Assert.Null(scan.Main.Method(Target + "#InstanceMethod()").ExtensionReceiver);
    }

    [Fact]
    public void ExtensionBlockMembersAreHoistedOntoTheStaticClass()
    {
        var method = scan.Main.Method(Extensions + "#ExtensionMemberMethod()");
        Expect.TypeRef(Target, method.ExtensionReceiver!);
        Assert.Equal(true, method.Bag("csharp.extensionBlock"));
        Assert.Empty(method.Signature.Parameters);
        Expect.Modifiers(method.Modifiers);
        var property = scan.Main.Property(Extensions + ".ExtensionMemberProperty");
        Expect.TypeRef(Target, property.ExtensionReceiver!);
        Assert.Equal([Accessor.Get], property.Accessors);
        Expect.Modifiers(scan.Main.Method(Extensions + "#ExtensionMemberStaticMethod()").Modifiers, Modifier.Static);
        Expect.Modifiers(scan.Main.Property(Extensions + ".ExtensionMemberStaticProperty").Modifiers, Modifier.Static);
        Expect.TypeRef("string", scan.Main.Method(Extensions + "#ExtensionMemberOnString()").ExtensionReceiver!);
        var generic = scan.Main.Method(Extensions + "#ExtensionMemberGeneric`1()");
        Assert.Equal("!!0", generic.ExtensionReceiver!.Canonical);
        Assert.Equal(generic.Id, Assert.IsType<TypeParameterRef>(generic.ExtensionReceiver).Owner);
        Assert.IsType<NotNullConstraint>(Assert.Single(Assert.Single(generic.TypeParameters).Constraints));
        Assert.True(scan.Main.Contains("csharp:T:" + Extensions, method.Id.Value));
        Assert.True(scan.Main.Contains("csharp:T:" + Extensions, property.Id.Value));
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Name.StartsWith("<M>$", StringComparison.Ordinal) || node.Id.Value.Contains("<M>$"));
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Id.Value == "csharp:M:" + Extensions + "#ExtensionMemberMethod(" + Target + ")");
        Assert.DoesNotContain(scan.Main.Nodes, node => node.Name.StartsWith("get_ExtensionMember", StringComparison.Ordinal));
        Expect.One(scan.Main.Invokes(method.Id.Value), edge => edge.To.Value == "csharp:M:" + Target + "#InstanceMethod()" && edge.Receiver == ExpressionKind.Parameter, "body of the extension member uses the receiver as a parameter");
    }

    [Fact]
    public void ExtensionBlockMembersAreCalledUnderTheirHoistedId()
    {
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ExtensionMemberMethod()" && edge.InvocationKind == InvocationKind.Extension && edge.Receiver == ExpressionKind.Local, "extension member method");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ExtensionMemberMethod()" && edge.Receiver == ExpressionKind.ReturnValue, "extension member method on a call result");
        Assert.Equal(2, Invokes.Count(edge => edge.To.Value == "csharp:M:" + Extensions + "#ExtensionMemberStaticMethod()" && edge.InvocationKind == InvocationKind.Call && edge.Receiver == ExpressionKind.Type));
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ExtensionMemberOnString()" && edge.Receiver == ExpressionKind.Literal, "extension member on a string literal");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:" + Extensions + "#ExtensionMemberGeneric`1()" && edge.TypeArguments.Single().Canonical == Target && edge.InvocationKind == InvocationKind.Extension, "generic extension member");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:" + Extensions + ".ExtensionMemberProperty" && edge.Receiver == ExpressionKind.Local && edge.Access == AccessKind.Read, "extension member property");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:" + Extensions + ".ExtensionMemberStaticProperty" && edge.Receiver == ExpressionKind.Type, "static extension member property");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:CSharpSyntax.OtherProject.StaticClassFromOtherProject.ExtensionMemberPropertyFromOtherProject" && edge.Receiver == ExpressionKind.Literal, "extension member property from the other project");
        Assert.True(scan.Other.Has("csharp:R:CSharpSyntax.OtherProject.StaticClassFromOtherProject.ExtensionMemberPropertyFromOtherProject"));
    }

    [Fact]
    public void DelegateInvocationsYieldNoCallButTheDelegateIsRead()
    {
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Func", StringComparison.Ordinal) || edge.To.Value.StartsWith("csharp:M:System.Action", StringComparison.Ordinal) || edge.To.Value.EndsWith("#Invoke()", StringComparison.Ordinal) || edge.To.Value.Contains("#BeginInvoke("));
        Expect.One(Accesses, edge => edge.To.Value == "csharp:F:CSharpSyntax.Invocations.InvocationForms._delegateField" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.This, "delegate field read");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:" + Target + ".DelegateProperty" && edge.Access == AccessKind.Read, "delegate property read");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:F:" + Target + ".NullableDelegateField" && edge.Access == AccessKind.Read && edge.Receiver == ExpressionKind.Local, "null-conditional delegate field read");
        Expect.One(Invokes, To("csharp:M:System.Delegate#DynamicInvoke(object[])", ExpressionKind.Field), "DynamicInvoke is an ordinary call");
        Expect.One(Invokes, To("csharp:M:" + Target + "#ReturnsDelegate()", ExpressionKind.Local), "returned delegate");
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.Contains("#FunctionPointer"));
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.Contains("#Identity("));
    }

    [Fact]
    public void EventAccessorsAreReadWriteAccessesWithTheAccessorInTheBag()
    {
        var add = Expect.One(Accesses, edge => edge.To.Value == "csharp:R:" + Target + ".Event" && edge.Site.Bag("csharp.eventAccessor") is "add", "event add");
        Assert.Equal(AccessKind.ReadWrite, add.Access);
        Assert.Equal(ExpressionKind.Local, add.Receiver);
        Assert.Equal(2, Accesses.Count(edge => edge.To.Value == "csharp:R:" + Target + ".Event" && edge.Site.Bag("csharp.eventAccessor") is "add"));
        Assert.Equal(1, Accesses.Count(edge => edge.To.Value == "csharp:R:" + Target + ".Event" && edge.Site.Bag("csharp.eventAccessor") is "remove"));
        Expect.One(Invokes, To("csharp:M:" + Target + "#RaiseEvent()", ExpressionKind.Local), "RaiseEvent");
        Assert.DoesNotContain(Invokes, edge => edge.To.Value == "csharp:M:CSharpSyntax.Invocations.InvocationForms#OnEvent(object,System.EventArgs)");
    }

    [Fact]
    public void UserDefinedOperatorsAreNotCallsYetButExplicitCastsAreTypeUses()
    {
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.Contains("#op_"));
        Expect.One(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == "int", "(int) user-defined explicit conversion");
        Expect.One(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == Target, "(InvocationTarget)objectReference");
        Expect.One(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == Target + "?", "objectReference as InvocationTarget");
        Expect.One(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == "CSharpSyntax.Invocations.IInvocationInterface", "(IInvocationInterface)new InvocationDerived()");
        Assert.DoesNotContain(scan.Main.UsesTypes(Forms), edge => edge.Role == TypeUseRole.Cast && edge.To.Canonical == "System.Func`1[int]");
    }

    [Fact]
    public void OwnIndexerReflectionAndStatementContexts()
    {
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:CSharpSyntax.Invocations.InvocationForms.this[" + Target + "]" && edge.Receiver == ExpressionKind.This && edge.Access == AccessKind.Read, "own indexer");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:System.Collections.Generic.List`1.this[int]" && edge.Receiver == ExpressionKind.Field, "List indexer");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:System.Collections.Generic.Dictionary`2.this[!0]" && edge.Receiver == ExpressionKind.Field, "Dictionary indexer");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:R:" + Target + ".this[int]" && edge.Receiver == ExpressionKind.Local, "custom indexer");
        Expect.One(Accesses, edge => edge.To.Value == "csharp:F:CSharpSyntax.Invocations.InvocationForms._counter" && edge.Access == AccessKind.ReadWrite && edge.Receiver == ExpressionKind.This, "compound assignment");
        Expect.One(Invokes, To("csharp:M:System.Type#GetMethod(string)", ExpressionKind.Other), "reflection GetMethod on typeof");
        Expect.One(Invokes, edge => edge.To.Value == "csharp:M:System.Activator#CreateInstance`1()" && edge.TypeArguments.Single().Canonical == Target && edge.Receiver == ExpressionKind.Type, "Activator.CreateInstance<T>");
        Expect.One(Invokes, To("csharp:M:System.Reflection.MethodBase#Invoke(object,object[])", ExpressionKind.Local), "MethodInfo.Invoke");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#CreateDisposable()", ExpressionKind.Type), "using (CreateDisposable())");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#ThrowingMethod()", ExpressionKind.Type), "try body");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#CreateException()", ExpressionKind.Type), "throw expression");
        Expect.One(Invokes, To("csharp:M:System.Exception#GetType()", ExpressionKind.Local), "exception filter");
        Expect.One(Invokes, To("csharp:M:System.Object#ReferenceEquals(object,object)", ExpressionKind.Type), "ReferenceEquals via implicit static");
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#LocalFunctionDeclaredLater()", ExpressionKind.This), "method named like a local function");
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.Contains("#LocalFunction(") || edge.To.Value.Contains("#StaticLocalFunction(") || edge.To.Value.Contains("GenericLocalFunction") || edge.To.Value.Contains("RecursiveLocalFunction"));
        Assert.DoesNotContain(Invokes, edge => edge.To.Value.Contains("#Deconstruct("));
    }

    [Fact]
    public void ConstructorCallsTargetTheConstructorAndUseTheType()
    {
        Assert.True(Invokes.Count(To("csharp:M:" + Target + "#.ctor()", null)) >= 4);
        Assert.True(Invokes.Count(To("csharp:M:" + Target + "#.ctor(int)", null)) >= 3);
        Assert.All(Invokes.Where(edge => edge.To.Value.EndsWith("#.ctor()", StringComparison.Ordinal)), edge => Assert.Equal(InvocationKind.Call, edge.InvocationKind));
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.GenericStaticClassForInvocations`1+NestedInstantiable#.ctor()", null), "nested type of a constructed generic");
        Expect.One(Invokes, To("csharp:M:System.Collections.Generic.List`1#.ctor(int)", null), "List(capacity)");
        var uses = scan.Main.UsesTypes(Forms).Where(edge => edge.Role == TypeUseRole.Creation).ToList();
        Assert.True(uses.Count(edge => edge.To.Canonical == Target) >= 7);
        Expect.One(uses, edge => edge.To.Canonical == "CSharpSyntax.Invocations.GenericStaticClassForInvocations`1+NestedInstantiable[int]", "constructed nested creation");
        Expect.One(uses, edge => edge.To.Canonical == "System.Collections.Generic.List`1[" + Target + "]", "List<InvocationTarget> creation");
        Expect.One(uses, edge => edge.To.Canonical == "int[]", "array creation");
        var viaConstraint = Assert.Single(scan.Main.UsesTypes("csharp:M:CSharpSyntax.Invocations.InvocationForms#CreateViaNewConstraint`1()"));
        Assert.Equal(TypeUseRole.Creation, viaConstraint.Role);
        Assert.Equal("!!0", viaConstraint.To.Canonical);
        Assert.Empty(scan.Main.Invokes("csharp:M:CSharpSyntax.Invocations.InvocationForms#CreateViaNewConstraint`1()"));
        Assert.Equal(Origin.Generated, scan.Main.Method("CSharpSyntax.Invocations.InvocationDerived#.ctor()").Origin);
        Expect.One(Invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationDerived#.ctor()", null), "implicit constructor is a target");
    }

    [Fact]
    public void DynamicSitesProduceDiagnosticsAndNoEdges()
    {
        var dynamicCall = RepositoryPaths.FixtureLine("CSharpSyntax/Invocations/InvocationForms.cs", "_ = dynamicLocal.InstanceMethod();");
        var dynamicChain = RepositoryPaths.FixtureLine("CSharpSyntax/Invocations/InvocationForms.cs", "_ = dynamicLocal.ReturnsSelf().InstanceMethod();");
        Assert.DoesNotContain(Invokes, edge => edge.Site.Location.StartLine == dynamicCall || edge.Site.Location.StartLine == dynamicChain);
        var diagnostics = scan.Main.Diagnostics.Where(diagnostic => diagnostic.Source == DiagnosticSource.Scanner && diagnostic.Location?.File.EndsWith("InvocationForms.cs", StringComparison.Ordinal) == true).ToList();
        Assert.True(diagnostics.Count >= 3, $"found {diagnostics.Count}");
        Assert.All(diagnostics, diagnostic => Assert.Equal(Model.DiagnosticSeverity.Info, diagnostic.Severity));
        Assert.Contains(diagnostics, diagnostic => diagnostic.Message.Contains("InstanceMethod") && diagnostic.Location!.StartLine == dynamicCall);
        Assert.Contains(diagnostics, diagnostic => diagnostic.Message.Contains("ReturnsSelf") && diagnostic.Location!.StartLine == dynamicChain);
        Assert.All(diagnostics, diagnostic => Assert.StartsWith("NS", diagnostic.Code));
    }

    [Fact]
    public void PropertiesIndexersConstructorsAndInitializersAreBodiesOfTheirOwn()
    {
        const string Owner = "CSharpSyntax.Invocations.InvocationForms";
        Expect.One(scan.Main.Invokes("csharp:R:" + Owner + ".PropertyInvokingMethod"), To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.Field), "expression-bodied property");
        Expect.One(scan.Main.Invokes("csharp:R:" + Owner + ".PropertySetterInvokingOnValue"), To("csharp:M:System.Int32#ToString()", ExpressionKind.Parameter), "setter on value");
        Expect.One(scan.Main.Invokes("csharp:R:" + Owner + ".this[" + Target + "]"), To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.Parameter), "indexer body");
        Assert.DoesNotContain(scan.Main.Accesses("csharp:R:" + Owner + ".PropertyInvokingOnFieldKeyword"), edge => edge.To.Value.Contains("PropertyInvokingOnFieldKeyword") || edge.To.Value.Contains("k__BackingField"));
        Expect.One(scan.Main.Invokes("csharp:R:" + Owner + ".PropertyInvokingOnFieldKeyword"), To("csharp:M:System.Int32#ToString()", ExpressionKind.Parameter), "setter with field keyword");
        Expect.One(scan.Main.Invokes("csharp:R:" + Owner + ".PropertyInvokingOnFieldKeywordInGetter"), To("csharp:M:" + Target + "#StaticMethod()", ExpressionKind.Type), "getter with field keyword");
        var constructor = scan.Main.Invokes("csharp:M:" + Owner + "#.ctor()").ToList();
        Expect.One(constructor, To("csharp:M:" + Owner + "#.ctor(int)", ExpressionKind.This), "this(...)");
        Expect.One(constructor, To("csharp:M:" + Target + "#StaticMethod()", ExpressionKind.Type), "argument of the initializer");
        Expect.One(scan.Main.Accesses("csharp:M:" + Owner + "#.ctor(int)"), edge => edge.To.Value == "csharp:F:" + Owner + "._counter" && edge.Access == AccessKind.Write, "constructor field write");
        Expect.One(scan.Main.Invokes("csharp:M:" + Owner + "#ExpressionBodiedMemberInvokingOthers()"), To("csharp:M:" + Owner + "#InstanceMethodOnThisClass()", ExpressionKind.This), "expression-bodied method");
        Assert.Equal(3, scan.Main.Invokes("csharp:M:" + Owner + "#ExpressionBodiedMemberInvokingOthers()").Count());

        const string Initializers = "CSharpSyntax.Invocations.InvocationsFromInitializers";
        Expect.One(scan.Main.Invokes("csharp:F:" + Initializers + "._fromFieldInitializer"), To("csharp:M:" + Target + "#StaticMethod()", ExpressionKind.Type), "field initializer");
        Expect.One(scan.Main.Invokes("csharp:R:" + Initializers + ".FromPropertyInitializer"), To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.Parameter), "property initializer on a primary constructor parameter");
        var fromParameter = scan.Main.Invokes("csharp:M:" + Initializers + "#FromPrimaryConstructorParameter()").ToList();
        Expect.One(fromParameter, To("csharp:M:" + Target + "#ReturnsSelf()", ExpressionKind.Parameter), "primary constructor parameter as receiver");
        Expect.One(fromParameter, To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.ReturnValue), "chained on the result");
        Expect.One(scan.Main.Accesses("csharp:M:" + Initializers + "#FromField()"), edge => edge.To.Value == "csharp:F:" + Initializers + "._fromFieldInitializer" && edge.Receiver == ExpressionKind.This, "field read");
        Expect.One(scan.Main.Invokes("csharp:F:CSharpSyntax.Invocations.InvocationForms._field"), To("csharp:M:" + Target + "#.ctor()", null), "target-typed new in a field initializer");
    }

    [Fact]
    public void AsyncBodiesAttributeAwaitedCallsToTheMethod()
    {
        const string Async = "csharp:M:CSharpSyntax.Invocations.InvocationForms#AsyncInvocationFormsAsync()";
        var invokes = scan.Main.Invokes(Async).ToList();
        Assert.True(invokes.Count(To("csharp:M:" + Target + "#ReturnsTaskOfSelf()", ExpressionKind.Local)) >= 4);
        Expect.One(invokes, To("csharp:M:" + Target + "#InstanceMethod()", ExpressionKind.ReturnValue), "call on an awaited value");
        Expect.One(invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Threading.Tasks.Task#WhenAll`1(", StringComparison.Ordinal) && edge.TypeArguments.Single().Canonical == Target, "Task.WhenAll<T>");
        Assert.Equal(2, invokes.Count(edge => edge.To.Value.StartsWith("csharp:M:System.Threading.Tasks.Task#Run`1(", StringComparison.Ordinal)));
        Expect.One(invokes, To("csharp:M:CSharpSyntax.Invocations.InvocationForms#AsyncSequence()", ExpressionKind.Type), "await foreach source");
        Expect.One(invokes, To("csharp:M:CSharpSyntax.Invocations.AsyncDisposableForInvocations#DisposeAsync()", ExpressionKind.Local), "explicit DisposeAsync");
        Expect.One(invokes, To("csharp:M:CSharpSyntax.Invocations.AsyncDisposableForInvocations#.ctor()", null), "await using creation");
        Expect.One(invokes, edge => edge.To.Value == "csharp:M:" + Target + "#InstanceMethod()" && edge.Receiver == ExpressionKind.Local && edge.Site.ViaClosure, "call inside the Task.Run lambda");
        Expect.One(invokes, edge => edge.To.Value.StartsWith("csharp:M:System.Threading.Tasks.Task`1#ConfigureAwait(", StringComparison.Ordinal) && edge.Receiver == ExpressionKind.ReturnValue, "ConfigureAwait");
        Assert.DoesNotContain(invokes, edge => edge.To.Value.Contains("GetAwaiter") || edge.To.Value.Contains("MoveNextAsync"));
    }

    [Fact]
    public void EverySiteHasALocationInsideTheMember()
    {
        var method = scan.Main.Method("CSharpSyntax.Invocations.InvocationForms#AllInvocationForms()");
        var span = Assert.Single(method.Locations);
        foreach (var edge in Invokes)
        {
            Assert.Equal(span.File, edge.Site.Location.File);
            Assert.InRange(edge.Site.Location.StartLine, span.StartLine, span.EndLine);
            Assert.True(edge.Site.Location.StartColumn >= 1);
        }
        Assert.Equal(Invokes.OrderBy(edge => edge.To.Value, StringComparer.Ordinal).ThenBy(edge => edge.Site.Location).Select(edge => (edge.To.Value, edge.Site.Location)), Invokes.Select(edge => (edge.To.Value, edge.Site.Location)));
    }
}
