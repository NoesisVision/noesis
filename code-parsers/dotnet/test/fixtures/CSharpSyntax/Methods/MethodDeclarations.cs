using System.Diagnostics.CodeAnalysis;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace CSharpSyntax.Methods;

public unsafe class MethodDeclarations
{
    private int _field;
    private readonly int[] _array = new int[4];

    public void PublicMethod() { }
    private void PrivateMethod() { }
    internal void InternalMethod() { }
    protected void ProtectedMethod() { }
    protected internal void ProtectedInternalMethod() { }
    private protected void PrivateProtectedMethod() { }
    void MethodWithoutAccessModifier() { }

    public static void StaticMethod() { }
    public void BlockBodiedMethod()
    {
        _field = 1;
    }
    public int ExpressionBodiedMethod() => _field;
    public void ExpressionBodiedVoidMethod() => _field = 2;

    public unsafe void UnsafeMethod(int* pointer) => *pointer = 1;

    [DllImport("libc", EntryPoint = "getpid")]
    private static extern int ExternMethod();

    [MethodImpl(MethodImplOptions.NoInlining)]
    public void MethodWithAttribute() { }

    [System.Diagnostics.Conditional("DEBUG")]
    public void ConditionalMethod() { }

    [DoesNotReturn]
    public void MethodThatDoesNotReturn() => throw new InvalidOperationException();

    public void @namespace() { }

    [return: NotNull]
    public string? MethodWithReturnAttribute() => "";

    public void MethodWithParameterAttribute([NotNull] string? parameter) => parameter ??= "";

    public void MethodWithCallerInfoDefaults(
        [CallerMemberName] string member = "",
        [CallerFilePath] string file = "",
        [CallerLineNumber] int line = 0,
        [CallerArgumentExpression(nameof(member))] string expression = "") { }

    public void MethodHidingNothingDeclaredWithNew() { }

    public new string ToString() => "";

    public MethodDeclarations() { }

    public MethodDeclarations(int field) => _field = field;

    public MethodDeclarations(int field, bool chained) : this(field) { }

    static MethodDeclarations() { }

    ~MethodDeclarations() => _field = 0;
}

public class ReturnTypes
{
    private int _field;
    private readonly int[] _array = new int[4];

    public void VoidReturn() { }
    public int PrimitiveReturn() => 0;
    public string ReferenceReturn() => "";
    public int? NullableValueReturn() => null;
    public string? NullableReferenceReturn() => null;
    public int[] ArrayReturn() => [];
    public int[,] MultiDimensionalArrayReturn() => new int[0, 0];
    public int[][] JaggedArrayReturn() => [];
    public (int, string) TupleReturn() => (1, "");
    public (int Count, string Name) NamedTupleReturn() => (Count: 1, Name: "");
    public List<int> GenericReturn() => [];
    public Dictionary<string, List<int>> NestedGenericReturn() => [];
    public IEnumerable<int> InterfaceReturn() => [];
    public object ObjectReturn() => new();
    public dynamic DynamicReturn() => 1;
    public Func<int, int> DelegateReturn() => static value => value;
    public Action ActionReturn() => static () => { };
    public ReturnTypes SelfTypeReturn() => this;
    public NestedTypeForReturn NestedTypeReturn() => new();
    public Task TaskReturn() => Task.CompletedTask;
    public Task<int> GenericTaskReturn() => Task.FromResult(1);
    public ValueTask ValueTaskReturn() => ValueTask.CompletedTask;
    public ValueTask<int> GenericValueTaskReturn() => ValueTask.FromResult(1);
    public Span<int> SpanReturn() => _array;
    public ReadOnlySpan<char> ReadOnlySpanReturn() => "";
    public ref int RefReturn() => ref _array[0];
    public ref readonly int RefReadonlyReturn() => ref _array[0];
    public ref int RefReturnOfField() => ref _field;
    public unsafe int* PointerReturn() => null;
    public unsafe delegate*<int, int> FunctionPointerReturn() => &StaticIdentity;
    public Type TypeReturn() => typeof(int);
    public PlainEnumForMethods EnumReturn() => PlainEnumForMethods.Member;
    public StructForMethods StructReturn() => default;
    public IEnumerable<int> IteratorReturn()
    {
        yield return 1;
        yield return 2;
        yield break;
    }
    public IEnumerator<int> EnumeratorIteratorReturn()
    {
        yield return 1;
    }
    public System.Collections.IEnumerable NonGenericIteratorReturn()
    {
        yield return 1;
    }
    public async IAsyncEnumerable<int> AsyncIteratorReturn([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await Task.Yield();
        yield return 1;
    }
    public async Task AsyncTaskReturn() => await Task.Yield();
    public async Task<int> AsyncGenericTaskReturn()
    {
        await Task.Yield();
        return 1;
    }
    public async ValueTask AsyncValueTaskReturn() => await Task.Yield();
    public async ValueTask<int> AsyncGenericValueTaskReturn()
    {
        await Task.Yield();
        return 1;
    }
    public async void AsyncVoidReturn() => await Task.Yield();

    private static int StaticIdentity(int value) => value;

    public class NestedTypeForReturn;
}

public enum PlainEnumForMethods
{
    Member,
}

public struct StructForMethods;

public class ParameterKinds
{
    public void NoParameters() { }
    public void SingleParameter(int value) { }
    public void MultipleParameters(int first, string second, bool third) { }
    public void RefParameter(ref int value) => value++;
    public void OutParameter(out int value) => value = 1;
    public void InParameter(in int value) { }
    public void RefReadonlyParameter(ref readonly int value) { }
    public void OptionalParameters(int value = 1, string text = "default", object? reference = null, PlainEnumForMethods enumValue = PlainEnumForMethods.Member, int? nullable = null) { }
    public void OptionalParameterWithDefaultLiteral(CancellationToken cancellationToken = default) { }
    public void OptionalParameterWithConstExpression(int value = 1 + 2) { }
    public void ParamsArrayParameter(params int[] values) { }
    public void ParamsSpanParameter(params ReadOnlySpan<int> values) { }
    public void ParamsCollectionParameter(params IEnumerable<int> values) { }
    public void ParamsListParameter(params List<string> values) { }
    public void ParamsAfterRegularParameters(string first, params object[] rest) { }
    public void NullableParameters(int? value, string? text) { }
    public void ArrayParameters(int[] single, int[,] multiDimensional, int[][] jagged) { }
    public void TupleParameters((int, string) unnamed, (int Count, string Name) named) { }
    public void GenericParameters(List<int> list, Dictionary<string, List<int>> nested, IEnumerable<int> enumerable) { }
    public void DelegateParameters(Action action, Func<int, int> func, Predicate<int> predicate, EventHandler handler) { }
    public void DynamicParameter(dynamic value) { }
    public void ObjectParameter(object value) { }
    public void SpanParameters(Span<int> span, ReadOnlySpan<char> readOnlySpan) { }
    public void ScopedParameter(scoped ReadOnlySpan<int> span) { }
    public void ScopedRefParameter(scoped ref int value) { }
    public unsafe void PointerParameters(int* pointer, void* voidPointer, delegate*<int, int> functionPointer) { }
    public void ParameterWithAttribute([Optional] int value) { }
    public void ParameterNamedWithVerbatimIdentifier(int @class, string @event) { }
    public void DiscardParameters(int _, string _1) { }
    public void NestedTypeParameter(ReturnTypes.NestedTypeForReturn nested) { }
    public void EnumParameter(PlainEnumForMethods value) { }
    public void StructParameter(StructForMethods value) { }
    public void InStructParameter(in StructForMethods value) { }
    public void SelfTypeParameter(ParameterKinds other) { }
    public void InterfaceParameter(IDisposable disposable) { }
    public void MultipleRefKinds(ref int byRef, out int output, in int byIn, ref readonly int refReadonly)
    {
        output = byRef + byIn + refReadonly;
    }
    public void OutParameterWithGenericType(out List<int> list) => list = [];
    public void RefParameterWithNullable(ref string? value) { }
    public void ParameterWithDefaultFromConst(int value = ConstDefault) { }

    private const int ConstDefault = 7;
}

public abstract class MethodModifiers
{
    public abstract void AbstractMethod();
    public virtual void VirtualMethod() { }
    public virtual int VirtualExpressionBodiedMethod() => 1;
    protected abstract int ProtectedAbstractMethod();
    public abstract T AbstractGenericMethod<T>(T value);
    public virtual void VirtualMethodToSeal() { }
    public void NonVirtualMethodToHide() { }
}

public class MethodModifiersDerived : MethodModifiers
{
    public override void AbstractMethod() { }
    public override void VirtualMethod() => base.VirtualMethod();
    public override int VirtualExpressionBodiedMethod() => base.VirtualExpressionBodiedMethod() + 1;
    protected override int ProtectedAbstractMethod() => 1;
    public override T AbstractGenericMethod<T>(T value) => value;
    public sealed override void VirtualMethodToSeal() { }
    public new void NonVirtualMethodToHide() { }
}

public struct MethodsInStruct
{
    private int _counter;

    public readonly int ReadonlyMethod() => _counter;

    public void MutatingMethod() => _counter++;

    public readonly void ReadonlyVoidMethod() { }

    public static MethodsInStruct StaticFactoryMethod() => default;
}

public static class StaticClassMethods
{
    public static void StaticMethodInStaticClass() { }

    public static int StaticExpressionBodiedMethod() => 1;
}

public interface IMethodsInInterface
{
    void AbstractMethodInInterface();

    void DefaultMethodInInterface() { }

    static void StaticMethodInInterface() { }

    static abstract void StaticAbstractMethodInInterface();

    static virtual void StaticVirtualMethodInInterface() { }

    T GenericMethodInInterface<T>(T value);
}

public record MethodsInRecord(int Value)
{
    public int MethodInRecord() => Value;

    public static MethodsInRecord StaticMethodInRecord() => new(0);
}

public partial class PartialMethods
{
    // Classic partial method: void, implicitly private, implementation optional.
    partial void ClassicPartialMethodWithoutImplementation();

    partial void ClassicPartialMethodWithImplementation();

    // Extended partial method: has accessibility, therefore must be implemented.
    public partial int ExtendedPartialMethod(int value);

    public partial void ExtendedPartialMethodWithOutParameter(out int value);

    public partial PartialMethods();

    public static partial PartialMethods CreateViaPartialStaticMethod();
}

public partial class PartialMethods
{
    partial void ClassicPartialMethodWithImplementation() { }

    public partial int ExtendedPartialMethod(int value) => value;

    public partial void ExtendedPartialMethodWithOutParameter(out int value) => value = 1;

    public partial PartialMethods() { }

    public static partial PartialMethods CreateViaPartialStaticMethod() => new();
}
