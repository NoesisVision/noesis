package vision.noesis.fixture.syntax.members;

import java.io.Serializable;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.IntBinaryOperator;
import java.util.function.IntConsumer;
import java.util.function.IntSupplier;
import java.util.function.IntUnaryOperator;
import java.util.function.Supplier;
import vision.noesis.fixture.syntax.annotations.OwnAnnotation;

/** Local classes, records, enums and interfaces standing in for local functions, and every lambda form. */
public class LocalFunctionsAndLambdas {

    private int field;

    public int methodWithLocalFunctions(int parameter) {
        int captured = parameter;

        class BlockBodiedLocalFunction {
            int invoke(int value) {
                return value + captured;
            }
        }

        class ExpressionBodiedLocalFunction {
            int invoke(int value) {
                return value + field;
            }
        }

        record StaticLocalFunction() {
            static int invoke(int value) {
                return value;
            }
        }

        enum LocalEnumFunction {
            INSTANCE;

            int invoke(int value) {
                return value;
            }
        }

        interface LocalInterfaceFunction {
            static int invoke(int value) {
                return value;
            }
        }

        class GenericLocalFunction {
            <T extends Number> T invoke(T value) {
                return value;
            }
        }

        class AsyncLocalFunction {
            CompletableFuture<Integer> invoke() {
                return CompletableFuture.supplyAsync(() -> captured);
            }
        }

        class IteratorLocalFunction implements Iterable<Integer> {
            @Override
            public Iterator<Integer> iterator() {
                return List.of(1).iterator();
            }
        }

        class LocalFunctionWithOptionalAndParams {
            void invoke(int value, int... rest) {
            }
        }

        @OwnAnnotation
        class LocalFunctionWithAttribute {
            @OwnAnnotation
            void invoke() {
            }
        }

        class NestedLocalFunctionOuter {
            void invoke() {
                class NestedLocalFunctionInner {
                    void invoke() {
                    }
                }
                new NestedLocalFunctionInner().invoke();
            }
        }

        new LocalFunctionWithOptionalAndParams().invoke(1);
        new LocalFunctionWithOptionalAndParams().invoke(1, 2, 3);
        new LocalFunctionWithAttribute().invoke();
        new NestedLocalFunctionOuter().invoke();
        int iterated = 0;
        for (int value : new IteratorLocalFunction()) {
            iterated += value;
        }
        return new BlockBodiedLocalFunction().invoke(1) + new ExpressionBodiedLocalFunction().invoke(2)
            + StaticLocalFunction.invoke(3) + LocalEnumFunction.INSTANCE.invoke(4) + LocalInterfaceFunction.invoke(5)
            + new GenericLocalFunction().invoke(6) + new AsyncLocalFunction().invoke().join() + iterated;
    }

    public int methodWithLambdas() {
        int capturedLocal = 1;
        Function<Integer, Integer> expressionLambda = value -> value + 1;
        Function<Integer, Integer> parenthesizedParameter = (value) -> value + 1;
        IntUnaryOperator explicitlyTypedParameter = (int value) -> value + 1;
        Function<Integer, Integer> varTypedParameter = (var value) -> value + 1;
        IntBinaryOperator twoParameters = (first, second) -> first + second;
        IntSupplier noParameters = () -> 1;
        Function<Integer, Integer> blockBodiedLambda = value -> {
            return value + 1;
        };
        IntUnaryOperator nonCapturingLambda = value -> value;
        Function<Integer, Integer> lambdaCapturingField = value -> value + field;
        Function<Integer, Integer> lambdaCapturingLocal = value -> value + capturedLocal;
        VarargsFunction lambdaWithParams = values -> values.length;
        Function<Integer, CompletableFuture<Integer>> asyncLambda = value -> CompletableFuture.supplyAsync(() -> value);
        Supplier<CompletableFuture<Void>> asyncExpressionLambda = () -> CompletableFuture.runAsync(() -> { });
        IntConsumer lambdaWithUnusedParameter = ignored -> { };
        TwoIntAction lambdaWithTwoUnusedParameters = (ignoredFirst, ignoredSecond) -> { };
        Function<Integer, Integer> lambdaWithAttribute = (@OwnAnnotation Integer value) -> value;
        Function<Integer, Function<Integer, Integer>> curriedLambda = first -> second -> first + second;
        Runnable anonymousMethod = new Runnable() {
            @Override
            public void run() {
            }
        };
        IntUnaryOperator anonymousMethodWithParameter = new IntUnaryOperator() {
            @Override
            public int applyAsInt(int value) {
                return value;
            }
        };
        IntUnaryOperator methodReference = LocalFunctionsAndLambdas::staticTarget;
        IntUnaryOperator boundMethodReference = this::instanceTarget;
        Object objectTypedLambda = (Runnable) () -> { };
        Object intersectionCastLambda = (Runnable & Serializable) () -> { };
        IntUnaryOperator conditionalLambda = value -> value > 0 ? value : -value;
        Function<Integer, String> switchExpressionLambda = value -> switch (value) {
            case 0 -> "zero";
            default -> "other";
        };
        Function<Integer, Integer> lambdaInvokingOtherLambda = value -> expressionLambda.apply(value);

        int sum = expressionLambda.apply(1) + parenthesizedParameter.apply(1) + explicitlyTypedParameter.applyAsInt(1)
            + varTypedParameter.apply(1) + twoParameters.applyAsInt(1, 2) + noParameters.getAsInt()
            + blockBodiedLambda.apply(1) + nonCapturingLambda.applyAsInt(1) + lambdaCapturingField.apply(1)
            + lambdaCapturingLocal.apply(1) + lambdaWithParams.apply(1, 2) + curriedLambda.apply(1).apply(2)
            + methodReference.applyAsInt(1) + boundMethodReference.applyAsInt(1) + conditionalLambda.applyAsInt(1)
            + lambdaInvokingOtherLambda.apply(1) + anonymousMethodWithParameter.applyAsInt(1)
            + lambdaWithAttribute.apply(1) + asyncLambda.apply(1).join() + switchExpressionLambda.apply(1).length();
        asyncExpressionLambda.get().join();
        lambdaWithUnusedParameter.accept(1);
        lambdaWithTwoUnusedParameters.accept(1, 2);
        anonymousMethod.run();
        ((Runnable) objectTypedLambda).run();
        ((Runnable) intersectionCastLambda).run();
        return sum;
    }

    private static int staticTarget(int value) {
        return value;
    }

    private int instanceTarget(int value) {
        return value + field;
    }

    @FunctionalInterface
    public interface VarargsFunction {
        int apply(int... values);
    }

    @FunctionalInterface
    public interface TwoIntAction {
        void accept(int first, int second);
    }
}
