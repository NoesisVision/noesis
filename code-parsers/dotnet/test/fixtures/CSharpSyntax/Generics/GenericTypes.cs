using System.Numerics;

namespace CSharpSyntax.Generics;

public class GenericClassWithOneParameter<T>
{
    public T? Value { get; set; }

    public T[] Values { get; set; } = [];

    public List<T> List { get; } = [];

    public GenericClassWithOneParameter<T> Self => this;

    public GenericClassWithOneParameter<List<T>> Nested => new();

    public class NestedClassSharingOuterParameter
    {
        public T? ValueFromOuter;
    }

    public class NestedGenericClass<TInner>
    {
        public (T Outer, TInner Inner) Pair;
    }
}

public class GenericClassWithTwoParameters<TFirst, TSecond>
    where TFirst : notnull
    where TSecond : notnull
{
    public TFirst? First { get; set; }

    public TSecond? Second { get; set; }

    public Dictionary<TFirst, TSecond> AsDictionary { get; } = new();

    public GenericClassWithTwoParameters<TSecond, TFirst> Swapped => new();
}

public struct GenericStructWithOneParameter<T>
{
    public T? Value;
}

public struct GenericStructWithTwoParameters<TFirst, TSecond>
{
    public TFirst? First;

    public TSecond? Second;
}

public interface IGenericInterfaceWithOneParameter<T>
{
    T Get();
}

public interface IGenericInterfaceWithTwoParameters<TFirst, TSecond>
{
    TSecond Map(TFirst value);
}

public record GenericRecordWithOneParameter<T>(T Value);

public record GenericRecordWithTwoParameters<TFirst, TSecond>(TFirst First, TSecond Second);

public record struct GenericRecordStructWithTwoParameters<TFirst, TSecond>(TFirst First, TSecond Second);

public delegate TResult GenericDelegateWithTwoParameters<in TArgument, out TResult>(TArgument argument);

public static class GenericStaticClass<T>
{
    public static T? StaticValue;

    public static T Identity(T value) => value;
}

public abstract class GenericAbstractClass<T>
{
    public abstract T Create();
}

public sealed class GenericSealedClass<T>;

public partial class GenericPartialClass<T>;

public partial class GenericPartialClass<T>
{
    public T? Value;
}

public class GenericClassWithClassConstraint<T> where T : class;

public class GenericClassWithStructConstraint<T> where T : struct;

public class GenericClassWithNewConstraint<T> where T : new()
{
    public T Create() => new();
}

public class GenericClassWithBaseClassConstraint<T> where T : Exception;

public class GenericClassWithInterfaceConstraint<T> where T : IDisposable;

public class GenericClassWithNotNullConstraint<T> where T : notnull;

public class GenericClassWithUnmanagedConstraint<T> where T : unmanaged;

public class GenericClassWithEnumConstraint<T> where T : struct, Enum;

public class GenericClassWithDelegateConstraint<T> where T : Delegate;

public class GenericClassWithNullableClassConstraint<T> where T : class?;

public class GenericClassWithAllowsRefStructConstraint<T> where T : allows ref struct;

public class GenericClassWithMultipleConstraints<T> where T : class, IDisposable, IComparable<T>, new();

public class GenericClassWithConstraintsOnBothParameters<TFirst, TSecond>
    where TFirst : class
    where TSecond : struct;

public class GenericClassWithDependentConstraint<TBase, TDerived> where TDerived : TBase;

public class GenericClassWithSelfReferencingConstraint<T> where T : IComparable<T>;

public class GenericClassWithGenericTypeConstraint<T> where T : IEnumerable<int>;

public class GenericClassWithStaticAbstractConstraint<T> where T : INumber<T>
{
    public T Sum(T left, T right) => left + right;

    public T Zero => T.Zero;
}

public class ClosedGenericUsages
{
    public GenericClassWithOneParameter<int> ClosedWithValueType = new();
    public GenericClassWithOneParameter<string> ClosedWithReferenceType = new();
    public GenericClassWithOneParameter<int?> ClosedWithNullableValueType = new();
    public GenericClassWithOneParameter<string?> ClosedWithNullableReferenceType = new();
    public GenericClassWithOneParameter<int[]> ClosedWithArray = new();
    public GenericClassWithOneParameter<(int, string)> ClosedWithTuple = new();
    public GenericClassWithOneParameter<GenericClassWithOneParameter<int>> ClosedWithGeneric = new();
    public GenericClassWithTwoParameters<int, string> ClosedTwoParameters = new();
    public GenericClassWithTwoParameters<List<int>, Dictionary<string, int[]>> ClosedTwoNested = new();
    public GenericClassWithOneParameter<int>.NestedClassSharingOuterParameter ClosedNested = new();
    public GenericClassWithOneParameter<int>.NestedGenericClass<string> ClosedNestedGeneric = new();
    public GenericClassWithOneParameter<dynamic> ClosedWithDynamic = new();
    public GenericClassWithOneParameter<object> ClosedWithObject = new();
    public GenericDelegateWithTwoParameters<int, string> ClosedDelegate = static value => value.ToString();
    public Type OpenGenericTypeOf = typeof(GenericClassWithOneParameter<>);
    public Type OpenGenericTypeOfTwoParameters = typeof(GenericClassWithTwoParameters<,>);
    public Type ClosedGenericTypeOf = typeof(GenericClassWithOneParameter<int>);
    public string OpenGenericNameOf = nameof(GenericClassWithOneParameter<>);
}

public class GenericClassWithOneParameter<T, TShadowingByArity>
{
    // Same name as the one-parameter class, different arity.
}

public class NonGenericClassWithGenericNested
{
    public class GenericNested<T>
    {
        public T? Value;
    }
}
