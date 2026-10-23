package vision.noesis.fixture.syntax.members;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import vision.noesis.fixture.syntax.annotations.OwnAnnotation;

/** Return types, parameter kinds, method modifiers, and methods in utility classes, interfaces and records. */
public final class ReturnAndParameterTypes {

    private ReturnAndParameterTypes() {
    }

    public enum PlainEnumForMethods {
        MEMBER
    }

    public static class ReturnTypes {
        private int field;
        private final int[] array = new int[4];

        public void voidReturn() {
        }

        public int primitiveReturn() {
            return field;
        }

        public String referenceReturn() {
            return "";
        }

        public Integer nullableValueReturn() {
            return null;
        }

        public int[] arrayReturn() {
            return array;
        }

        public int[][] jaggedArrayReturn() {
            return new int[0][];
        }

        public List<Integer> genericReturn() {
            return new ArrayList<>();
        }

        public Map<String, List<Integer>> nestedGenericReturn() {
            return new HashMap<>();
        }

        public Iterable<Integer> interfaceReturn() {
            return List.of();
        }

        public Iterator<Integer> iteratorReturn() {
            return List.of(1).iterator();
        }

        public Iterable nonGenericIteratorReturn() {
            return List.of(1);
        }

        public Object objectReturn() {
            return new Object();
        }

        public Function<Integer, Integer> delegateReturn() {
            return value -> value;
        }

        public Runnable actionReturn() {
            return () -> { };
        }

        public ReturnTypes selfTypeReturn() {
            return this;
        }

        public NestedTypeForReturn nestedTypeReturn() {
            return new NestedTypeForReturn();
        }

        public CompletableFuture<Void> taskReturn() {
            return CompletableFuture.completedFuture(null);
        }

        public CompletableFuture<Integer> genericTaskReturn() {
            return CompletableFuture.completedFuture(1);
        }

        public Class<?> typeReturn() {
            return int.class;
        }

        public PlainEnumForMethods enumReturn() {
            return PlainEnumForMethods.MEMBER;
        }

        public static class NestedTypeForReturn {
        }
    }

    public static class ParameterKinds {
        public void noParameters() {
        }

        public void singleParameter(int value) {
        }

        public void multipleParameters(int first, String second, boolean third) {
        }

        public void paramsArrayParameter(int... values) {
        }

        public void paramsAfterRegularParameters(String first, Object... rest) {
        }

        public void annotatedVarargsParameter(@OwnAnnotation int... values) {
        }

        public void finalParameter(final int value) {
        }

        public void nullableParameters(Integer value, String text) {
        }

        public void arrayParameters(int[] single, int[][] jagged) {
        }

        public void genericParameters(List<Integer> list, Map<String, List<Integer>> nested, Iterable<Integer> iterable) {
        }

        public void delegateParameters(Runnable action, Function<Integer, Integer> function, Predicate<Integer> predicate, Consumer<Integer> consumer) {
        }

        public void objectParameter(Object value) {
        }

        public void parameterWithAttribute(@OwnAnnotation int value) {
        }

        public void nestedTypeParameter(ReturnTypes.NestedTypeForReturn nested) {
        }

        public void enumParameter(PlainEnumForMethods value) {
        }

        public void selfTypeParameter(ParameterKinds other) {
        }

        public void interfaceParameter(AutoCloseable closeable) {
        }
    }

    public abstract static class MethodModifiers {
        public abstract void abstractMethod();

        public void virtualMethod() {
        }

        public int virtualExpressionBodiedMethod() {
            return 1;
        }

        protected abstract int protectedAbstractMethod();

        public abstract <T> T abstractGenericMethod(T value);

        public void virtualMethodToSeal() {
        }
    }

    public static class MethodModifiersDerived extends MethodModifiers {
        @Override
        public void abstractMethod() {
        }

        @Override
        public void virtualMethod() {
            super.virtualMethod();
        }

        @Override
        public int virtualExpressionBodiedMethod() {
            return super.virtualExpressionBodiedMethod() + 1;
        }

        @Override
        protected int protectedAbstractMethod() {
            return 1;
        }

        @Override
        public <T> T abstractGenericMethod(T value) {
            return value;
        }

        @Override
        public final void virtualMethodToSeal() {
        }
    }

    public static final class StaticClassMethods {
        private StaticClassMethods() {
        }

        public static void staticMethodInStaticClass() {
        }

        public static int staticExpressionBodiedMethod() {
            return 1;
        }
    }

    public interface MethodsInInterface {
        void abstractMethodInInterface();

        default void defaultMethodInInterface() {
            privateStaticMethodInInterface();
        }

        static void staticMethodInInterface() {
        }

        private static void privateStaticMethodInInterface() {
        }

        <T> T genericMethodInInterface(T value);
    }

    public record MethodsInRecord(int value) {
        public int methodInRecord() {
            return value;
        }

        public static MethodsInRecord staticMethodInRecord() {
            return new MethodsInRecord(0);
        }
    }

    public static class ObjectMethodOverrides {
        private final int value;

        public ObjectMethodOverrides(int value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return "ObjectMethodOverrides(" + value + ")";
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof ObjectMethodOverrides that && that.value == value;
        }

        @Override
        public int hashCode() {
            return Integer.hashCode(value);
        }

        @Override
        protected void finalize() {
        }
    }
}
