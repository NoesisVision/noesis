package vision.noesis.fixture.syntax.generics;

import java.util.List;
import java.util.Map;

/** Generic types: own parameters, inner classes sharing the outer's, bounds, wildcards, raw types. */
public final class GenericTypes {

    private GenericTypes() {
    }

    public static class GenericClassWithOneParameter<T> {
        public T value;

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
    }

    public static class GenericClassWithTwoParameters<K, V> {
        public K key;
        public V value;
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
}
