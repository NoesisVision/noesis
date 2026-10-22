package vision.noesis.fixture.syntax.generics;

import java.util.List;
import java.util.Map;

/** Generic types: own parameters, inner classes sharing the outer's, bounds, wildcards, raw types. */
public final class GenericTypes {

    private GenericTypes() {
    }

    public static class GenericClassWithOneParameter<T> {
        public T value;
        public T[] values;
        public List<T> list;

        public class NestedClassSharingOuterParameter {
            public T inner;
        }

        public class NestedGenericClass<TInner> {
            public Map<T, TInner> map;
        }

        public static class StaticNestedGeneric<U> {
            public U unrelated;
        }

        public GenericClassWithOneParameter<T> self() {
            return this;
        }

        public GenericClassWithOneParameter<List<T>> nested() {
            return new GenericClassWithOneParameter<>();
        }
    }

    public static class GenericClassWithTwoParameters<K, V> {
        public K key;
        public V value;
        public Map<K, V> asMap;

        public GenericClassWithTwoParameters<V, K> swapped() {
            return new GenericClassWithTwoParameters<>();
        }
    }

    public static class BoundedGeneric<T extends Number & Comparable<T>> {
        public T bounded;
    }

    public interface SelfBounded<T extends SelfBounded<T>> {
        T next();
    }

    public static class WildcardUses {
        public List<? extends Number> covariant;
        public List<? super Integer> contravariant;
        public List<?> unbounded;
        @SuppressWarnings("rawtypes")
        public List raw;
        public Map<String, List<Integer>> nested;
        public GenericClassWithOneParameter<String>.NestedClassSharingOuterParameter innerOfConstructed;
        public GenericClassWithOneParameter<String>.NestedGenericClass<Integer> innerGenericOfConstructed;
        public GenericClassWithOneParameter.StaticNestedGeneric<Long> staticNested;
    }

    public interface GenericInterfaceWithTwoParameters<F, S> {
        S map(F value);
    }

    public record GenericRecordWithTwoParameters<F, S>(F first, S second) {
    }

    @FunctionalInterface
    public interface GenericDelegateWithTwoParameters<A, R> {
        R invoke(A argument);
    }

    public static final class GenericStaticClass<T> {
        public static Object staticValue;

        private GenericStaticClass() {
        }

        public static <S> S identity(S value) {
            return value;
        }
    }

    public abstract static class GenericAbstractClass<T> {
        public abstract T create();
    }

    public static final class GenericFinalClass<T> {
        public T value;
    }

    public static class GenericClassWithBaseClassConstraint<T extends Exception> {
        public T error;
    }

    public static class GenericClassWithInterfaceConstraint<T extends AutoCloseable> {
        public T resource;
    }

    public static class GenericClassWithEnumConstraint<T extends Enum<T>> {
        public T constant;
    }

    public static class GenericClassWithMultipleConstraints<T extends Exception & AutoCloseable & Comparable<T>> {
        public T bounded;
    }

    public static class GenericClassWithConstraintsOnBothParameters<A extends Number, B extends CharSequence> {
        public A first;
        public B second;
    }

    public static class GenericClassWithDependentConstraint<B, D extends B> {
        public B base;
        public D derived;
    }

    public static class GenericClassWithGenericTypeConstraint<T extends Iterable<Integer>> {
        public T items;
    }

    public static class ClosedGenericUsages {
        public GenericClassWithOneParameter<Integer> closedWithValueType = new GenericClassWithOneParameter<>();
        public GenericClassWithOneParameter<String> closedWithReferenceType = new GenericClassWithOneParameter<>();
        public GenericClassWithOneParameter<int[]> closedWithArray = new GenericClassWithOneParameter<>();
        public GenericClassWithOneParameter<GenericClassWithOneParameter<Integer>> closedWithGeneric = new GenericClassWithOneParameter<>();
        public GenericClassWithTwoParameters<Integer, String> closedTwoParameters = new GenericClassWithTwoParameters<>();
        public GenericClassWithTwoParameters<List<Integer>, Map<String, int[]>> closedTwoNested = new GenericClassWithTwoParameters<>();
        public GenericClassWithOneParameter<Integer>.NestedClassSharingOuterParameter closedNested = closedWithValueType.new NestedClassSharingOuterParameter();
        public GenericClassWithOneParameter<Integer>.NestedGenericClass<String> closedNestedGeneric = closedWithValueType.new NestedGenericClass<String>();
        public GenericClassWithOneParameter<Object> closedWithObject = new GenericClassWithOneParameter<>();
        public GenericDelegateWithTwoParameters<Integer, String> closedDelegate = value -> value.toString();
        public Class<?> openGenericTypeOf = GenericClassWithOneParameter.class;
        public Class<?> openGenericTypeOfTwoParameters = GenericClassWithTwoParameters.class;
    }
}
