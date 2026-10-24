namespace CSharpSyntax.Types;

public delegate void VoidDelegateWithoutParameters();

public delegate int DelegateWithReturnValue(int argument);

public delegate TResult GenericDelegate<in TArgument, out TResult>(TArgument argument);

public delegate T GenericDelegateWithConstraint<T>(T argument) where T : struct;

public delegate void DelegateWithRefOutIn(ref int byReference, out int output, in int readOnlyReference);

public delegate void DelegateWithParamsArray(params int[] values);

public delegate void DelegateWithOptionalParameter(int value = 0, string? text = null);

public delegate ref int RefReturningDelegate(int[] array);

public delegate ref readonly int RefReadonlyReturningDelegate(int[] array);

public unsafe delegate void* PointerDelegate(void* pointer);

public delegate Task AsyncReturningDelegate(CancellationToken cancellationToken);

internal delegate void InternalDelegate();

public delegate (int Sum, int Count) TupleReturningDelegate(IEnumerable<int> values);
