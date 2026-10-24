namespace CSharpSyntax.Generics;

public class GenericMethods
{
    public T GenericMethodWithOneParameter<T>(T value) => value;

    public TResult GenericMethodWithTwoParameters<TArgument, TResult>(TArgument argument, Func<TArgument, TResult> map) => map(argument);

    public void GenericMethodWithoutUsingParameterInSignature<T>() { }

    public T GenericMethodWithClassConstraint<T>(T value) where T : class => value;

    public T GenericMethodWithStructConstraint<T>(T value) where T : struct => value;

    public T GenericMethodWithNewConstraint<T>() where T : new() => new();

    public T GenericMethodWithMultipleConstraints<T>(T value) where T : class, IComparable<T>, new() => value;

    public TDerived GenericMethodWithDependentConstraint<TBase, TDerived>(TDerived value) where TDerived : TBase => value;

    public T? GenericMethodWithNullableReturn<T>(T? value) => value;

    public T? GenericMethodReturningNullableValueType<T>(T value) where T : struct => value;

    public T[] GenericMethodWithArrayReturn<T>(params T[] values) => values;

    public List<T> GenericMethodWithGenericReturn<T>(IEnumerable<T> values) => values.ToList();

    public (TFirst, TSecond) GenericMethodWithTupleReturn<TFirst, TSecond>(TFirst first, TSecond second) => (first, second);

    public Dictionary<TKey, TValue> GenericMethodWithTwoParametersAndNestedGeneric<TKey, TValue>(IEnumerable<KeyValuePair<TKey, TValue>> pairs) where TKey : notnull => new(pairs);

    public static T StaticGenericMethod<T>(T value) => value;

    public async Task<T> AsyncGenericMethod<T>(T value)
    {
        await Task.Yield();
        return value;
    }

    public IEnumerable<T> IteratorGenericMethod<T>(T value)
    {
        yield return value;
    }

    public void GenericMethodWithRefAndOut<T>(ref T byRef, out T output) => output = byRef;

    public void GenericMethodWithInParameter<T>(in T value) where T : struct { }

    public ref T GenericMethodWithRefReturn<T>(T[] array) => ref array[0];

    public void GenericMethodWithDefaultLiteral<T>(T value = default!) { }

    public T GenericMethodWithLocalGenericFunction<T>(T value)
    {
        static TLocal LocalGeneric<TLocal>(TLocal local) => local;
        return LocalGeneric(value);
    }

    public T GenericMethodWithTypeParameterShadowingClassParameter<T>(T value) => value;

    public void GenericMethodWithAllowsRefStruct<T>(T value) where T : allows ref struct { }

    public TEnum GenericMethodWithEnumConstraint<TEnum>(string name) where TEnum : struct, Enum => Enum.Parse<TEnum>(name);

    public void GenericMethodWithUnmanagedConstraint<T>(Span<T> span) where T : unmanaged { }

    public T GenericMethodWithDelegateConstraint<T>(T value) where T : Delegate => value;
}

public class GenericClassWithGenericMethods<TClass>
{
    public TClass? ClassValue;

    public TMethod MethodWithOwnParameter<TMethod>(TMethod value) => value;

    public (TClass?, TMethod) MethodMixingClassAndMethodParameters<TMethod>(TMethod value) => (ClassValue, value);

    public TMethod MethodWithConstraintReferencingClassParameter<TMethod>(TMethod value) where TMethod : TClass => value;
}

public abstract class GenericVirtualMethods
{
    public abstract T AbstractGenericMethod<T>(T value);

    public virtual T VirtualGenericMethod<T>(T value) where T : class => value;
}

public class GenericVirtualMethodsOverridden : GenericVirtualMethods
{
    public override T AbstractGenericMethod<T>(T value) => value;

    // Constraints are inherited from the overridden method and must not be repeated.
    public override T VirtualGenericMethod<T>(T value) => base.VirtualGenericMethod(value);
}

public interface IGenericMethodsInInterface
{
    T Method<T>(T value);

    static abstract T StaticAbstractGenericMethod<T>(T value);
}

public class GenericMethodsInInterfaceImplementation : IGenericMethodsInInterface
{
    public T Method<T>(T value) => value;

    public static T StaticAbstractGenericMethod<T>(T value) => value;
}

public static class GenericExtensionMethods
{
    public static T ClassicGenericExtensionMethod<T>(this T receiver) => receiver;

    public static TResult ClassicGenericExtensionMethodWithTwoParameters<TReceiver, TResult>(this TReceiver receiver, Func<TReceiver, TResult> map) => map(receiver);

    public static IEnumerable<T> ClassicGenericExtensionOnGenericReceiver<T>(this IEnumerable<T> receiver) => receiver;

    extension<T>(IEnumerable<T> receiver)
    {
        public bool ExtensionMemberIsEmpty => !receiver.Any();

        public IEnumerable<TResult> ExtensionMemberMap<TResult>(Func<T, TResult> map) => receiver.Select(map);
    }

    extension<TFirst, TSecond>((TFirst, TSecond) receiver)
    {
        public (TSecond, TFirst) ExtensionMemberSwap() => (receiver.Item2, receiver.Item1);
    }
}

public class GenericMethodInvocations
{
    public void InvokeWithInferredAndExplicitTypeArguments()
    {
        var methods = new GenericMethods();
        int inferred = methods.GenericMethodWithOneParameter(1);
        int explicitArgument = methods.GenericMethodWithOneParameter<int>(1);
        string twoInferred = methods.GenericMethodWithTwoParameters(1, static value => value.ToString());
        string twoExplicit = methods.GenericMethodWithTwoParameters<int, string>(1, static value => value.ToString());
        methods.GenericMethodWithoutUsingParameterInSignature<string>();
        int viaStatic = GenericMethods.StaticGenericMethod(1);
        int viaStaticClass = GenericStaticClass<int>.Identity(1);
        int viaClassicExtension = 1.ClassicGenericExtensionMethod();
        bool viaExtensionMember = new List<int>().ExtensionMemberIsEmpty;
        var swapped = (1, "").ExtensionMemberSwap();
        var mapped = new[] { 1 }.ExtensionMemberMap(static value => value.ToString());
        var closedNested = new GenericClassWithOneParameter<int>.NestedGenericClass<string>();
        _ = inferred + explicitArgument + viaStatic + viaStaticClass + viaClassicExtension + twoInferred.Length + twoExplicit.Length;
        _ = viaExtensionMember;
        _ = swapped;
        _ = mapped;
        _ = closedNested;
    }
}
