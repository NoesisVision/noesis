namespace CSharpSyntax.Methods;

public class LocalFunctionsAndLambdas
{
    private int _field;

    public int MethodWithLocalFunctions(int parameter)
    {
        int captured = parameter;

        int BlockBodiedLocalFunction(int value)
        {
            return value + captured;
        }

        int ExpressionBodiedLocalFunction(int value) => value + _field;

        static int StaticLocalFunction(int value) => value;

        T GenericLocalFunction<T>(T value) where T : struct => value;

        async Task<int> AsyncLocalFunction()
        {
            await Task.Yield();
            return 1;
        }

        IEnumerable<int> IteratorLocalFunction()
        {
            yield return 1;
        }

        void LocalFunctionWithRefAndOut(ref int byRef, out int output) => output = byRef;

        void LocalFunctionWithOptionalAndParams(int value = 1, params int[] rest) { }

        unsafe void UnsafeLocalFunction(int* pointer) { }

        int LocalFunctionDeclaredAfterUse() => 1;

        [Obsolete] void LocalFunctionWithAttribute() { }

        static void NestedLocalFunctionOuter()
        {
            static void NestedLocalFunctionInner() { }
            NestedLocalFunctionInner();
        }

        int refValue = 1;
        LocalFunctionWithRefAndOut(ref refValue, out int outValue);
        NestedLocalFunctionOuter();
        return BlockBodiedLocalFunction(1) + ExpressionBodiedLocalFunction(2) + StaticLocalFunction(3)
            + GenericLocalFunction(4) + AsyncLocalFunction().Result + IteratorLocalFunction().Sum()
            + LocalFunctionDeclaredAfterUse() + outValue;
    }

    public void MethodWithLambdas()
    {
        Func<int, int> expressionLambda = value => value + 1;
        Func<int, int> parenthesizedParameter = (value) => value + 1;
        Func<int, int> explicitlyTypedParameter = (int value) => value + 1;
        Func<int, int, int> twoParameters = (first, second) => first + second;
        Func<int> noParameters = () => 1;
        Func<int, int> blockBodiedLambda = value =>
        {
            return value + 1;
        };
        Func<int, int> staticLambda = static value => value;
        Func<int, int> lambdaCapturingField = value => value + _field;
        Func<int, int> lambdaWithExplicitReturnType = int (value) => value;
        var lambdaWithDefaultParameter = (int value = 1) => value;
        var lambdaWithParams = (params int[] values) => values.Length;
        Func<int, Task<int>> asyncLambda = async value =>
        {
            await Task.Yield();
            return value;
        };
        Func<int, Task> asyncExpressionLambda = async _ => await Task.Yield();
        Action<int> lambdaWithDiscard = _ => { };
        Action<int, int> lambdaWithTwoDiscards = (_, _) => { };
        Func<int, int> lambdaWithAttribute = [Obsolete] (value) => value;
        Func<int, Func<int, int>> curriedLambda = first => second => first + second;
        Action anonymousMethod = delegate { };
        Func<int, int> anonymousMethodWithParameter = delegate (int value) { return value; };
        var lambdaWithNaturalType = (int value) => value;
        var methodGroupWithNaturalType = StaticTarget;
        Delegate delegateTypedLambda = (int value) => value;
        object objectTypedLambda = (int value) => value;
        RefAction lambdaWithRefModifierOnly = (ref value) => value++;
        OutAction lambdaWithOutModifierOnly = (out value) => value = 1;
        Func<int, int> conditionalLambda = value => value > 0 ? value : -value;
        Func<int, string> switchExpressionLambda = value => value switch { 0 => "zero", _ => "other" };
        Func<int, int> lambdaInvokingOtherLambda = value => expressionLambda(value);

        _ = expressionLambda(1) + parenthesizedParameter(1) + explicitlyTypedParameter(1) + twoParameters(1, 2)
            + noParameters() + blockBodiedLambda(1) + staticLambda(1) + lambdaCapturingField(1)
            + lambdaWithExplicitReturnType(1) + lambdaWithDefaultParameter() + lambdaWithParams(1, 2)
            + curriedLambda(1)(2) + lambdaWithNaturalType(1) + methodGroupWithNaturalType(1)
            + conditionalLambda(1) + lambdaInvokingOtherLambda(1) + anonymousMethodWithParameter(1)
            + lambdaWithAttribute(1);
        _ = asyncLambda(1);
        _ = asyncExpressionLambda(1);
        lambdaWithDiscard(1);
        lambdaWithTwoDiscards(1, 2);
        anonymousMethod();
        int refTarget = 0;
        lambdaWithRefModifierOnly(ref refTarget);
        lambdaWithOutModifierOnly(out int outTarget);
        _ = delegateTypedLambda;
        _ = objectTypedLambda;
        _ = switchExpressionLambda(1);
    }

    private static int StaticTarget(int value) => value;

    public delegate void RefAction(ref int value);

    public delegate void OutAction(out int value);
}
