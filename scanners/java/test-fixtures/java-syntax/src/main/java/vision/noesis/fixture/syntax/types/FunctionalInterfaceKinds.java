package vision.noesis.fixture.syntax.types;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

/** Functional interfaces of every shape, each targeted by a lambda, a method reference or an anonymous class. */
public final class FunctionalInterfaceKinds {

    private FunctionalInterfaceKinds() {
    }

    @FunctionalInterface
    public interface VoidFunctionWithoutParameters {
        void invoke();
    }

    @FunctionalInterface
    public interface FunctionWithReturnValue {
        int apply(int argument);
    }

    @FunctionalInterface
    public interface GenericFunction<A, R> {
        R apply(A argument);
    }

    @FunctionalInterface
    public interface GenericFunctionWithBound<T extends Number> {
        T apply(T argument);
    }

    @FunctionalInterface
    public interface FunctionWithVarargs {
        void accept(int... values);
    }

    @FunctionalInterface
    public interface AsyncReturningFunction {
        CompletableFuture<Void> apply(int argument);
    }

    @FunctionalInterface
    interface PackagePrivateFunction {
        void invoke();
    }

    public record SumAndCount(int sum, int count) {
    }

    @FunctionalInterface
    public interface RecordReturningFunction {
        SumAndCount apply(List<Integer> values);
    }

    @FunctionalInterface
    public interface FunctionWithDefaultAndStaticMethods {
        int apply(int argument);

        default int applyTwice(int argument) {
            return apply(apply(argument));
        }

        static FunctionWithDefaultAndStaticMethods identity() {
            return argument -> argument;
        }
    }

    @FunctionalInterface
    public interface FunctionExtendingLibraryInterface extends Function<Integer, Integer> {
    }

    public static int useAll() {
        VoidFunctionWithoutParameters voidLambda = () -> { };
        VoidFunctionWithoutParameters voidMethodReference = FunctionalInterfaceKinds::staticTarget;
        VoidFunctionWithoutParameters voidAnonymous = new VoidFunctionWithoutParameters() {
            @Override
            public void invoke() {
            }
        };
        FunctionWithReturnValue returningLambda = argument -> argument + 1;
        FunctionWithReturnValue returningMethodReference = FunctionalInterfaceKinds::identity;
        FunctionWithReturnValue returningAnonymous = new FunctionWithReturnValue() {
            @Override
            public int apply(int argument) {
                return argument;
            }
        };
        GenericFunction<Integer, String> genericLambda = argument -> Integer.toString(argument);
        GenericFunction<Integer, String> genericMethodReference = Objects::toString;
        GenericFunction<? super Integer, ? extends CharSequence> wildcardTyped = genericLambda;
        GenericFunctionWithBound<Integer> boundedLambda = argument -> argument * 2;
        GenericFunctionWithBound<Integer> boundedMethodReference = FunctionalInterfaceKinds::identity;
        FunctionWithVarargs varargsLambda = values -> { };
        FunctionWithVarargs varargsMethodReference = FunctionalInterfaceKinds::acceptAll;
        AsyncReturningFunction asyncLambda = argument -> CompletableFuture.runAsync(() -> { });
        AsyncReturningFunction asyncMethodReference = FunctionalInterfaceKinds::completeAsync;
        PackagePrivateFunction packagePrivateLambda = () -> { };
        RecordReturningFunction recordLambda = values -> new SumAndCount(values.size(), values.size());
        RecordReturningFunction recordMethodReference = FunctionalInterfaceKinds::summarize;
        FunctionWithDefaultAndStaticMethods withDefaultMethod = argument -> argument + 1;
        FunctionWithDefaultAndStaticMethods fromStaticFactory = FunctionWithDefaultAndStaticMethods.identity();
        FunctionExtendingLibraryInterface extendingLambda = argument -> argument;
        FunctionExtendingLibraryInterface extendingMethodReference = FunctionalInterfaceKinds::identityBoxed;

        voidLambda.invoke();
        voidMethodReference.invoke();
        voidAnonymous.invoke();
        varargsLambda.accept();
        varargsLambda.accept(1, 2);
        varargsMethodReference.accept(1);
        asyncLambda.apply(1).join();
        asyncMethodReference.apply(2).join();
        packagePrivateLambda.invoke();
        return returningLambda.apply(1) + returningMethodReference.apply(2) + returningAnonymous.apply(3)
            + genericLambda.apply(4).length() + genericMethodReference.apply(5).length() + wildcardTyped.apply(6).length()
            + boundedLambda.apply(7) + boundedMethodReference.apply(8)
            + recordLambda.apply(List.of(1, 2)).sum() + recordMethodReference.apply(List.of(3)).count()
            + withDefaultMethod.applyTwice(9) + fromStaticFactory.apply(10)
            + extendingLambda.apply(11) + extendingMethodReference.andThen(value -> value).apply(12);
    }

    private static void staticTarget() {
    }

    private static int identity(int value) {
        return value;
    }

    private static Integer identityBoxed(Integer value) {
        return value;
    }

    private static void acceptAll(int... values) {
    }

    private static CompletableFuture<Void> completeAsync(int argument) {
        return CompletableFuture.completedFuture(null);
    }

    private static SumAndCount summarize(List<Integer> values) {
        return new SumAndCount(values.size(), values.size());
    }
}
