package vision.noesis.fixture.syntax.generics;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.Supplier;

/** Generic methods and their calls: explicit, inferred, varargs. */
public class GenericMethods {

    public <T> T identity(T value) {
        return value;
    }

    public <K, V extends Comparable<V>> V maxValue(Map<K, V> map) {
        V best = null;
        for (V value : map.values()) {
            if (best == null || value.compareTo(best) > 0) best = value;
        }
        return best;
    }

    @SafeVarargs
    public static <T> List<T> listOf(T... items) {
        return Arrays.asList(items);
    }

    public <T extends Number> double sum(List<? extends T> numbers) {
        double total = 0;
        for (T number : numbers) total += number.doubleValue();
        return total;
    }

    public void callers(Map<String, Integer> map) {
        String explicit = this.<String>identity("explicit");
        Integer inferred = identity(1);
        List<String> list = listOf(explicit, inferred.toString());
        Integer max = maxValue(map);
        double total = sum(list.isEmpty() ? List.of(max) : List.of(1, 2));
        System.out.println(total);
    }

    public <A, R> R genericMethodWithTwoParameters(A argument, Function<A, R> map) {
        return map.apply(argument);
    }

    public <T> void genericMethodWithoutUsingParameterInSignature() {
    }

    public <T> T genericMethodWithNewConstraint(Supplier<T> factory) {
        return factory.get();
    }

    public <T extends Number & Comparable<T>> T genericMethodWithMultipleConstraints(T value) {
        return value;
    }

    public <B, D extends B> D genericMethodWithDependentConstraint(D value) {
        return value;
    }

    public <T> T[] genericMethodWithArrayReturn(T... values) {
        return values;
    }

    public <T> List<T> genericMethodWithGenericReturn(Iterable<T> values) {
        List<T> list = new ArrayList<>();
        for (T value : values) list.add(value);
        return list;
    }

    public <K, V> Map<K, V> genericMethodWithTwoParametersAndNestedGeneric(Iterable<Map.Entry<K, V>> pairs) {
        Map<K, V> map = new HashMap<>();
        for (Map.Entry<K, V> pair : pairs) map.put(pair.getKey(), pair.getValue());
        return map;
    }

    public static <T> T staticGenericMethod(T value) {
        return value;
    }

    public <T> CompletableFuture<T> asyncGenericMethod(T value) {
        return CompletableFuture.completedFuture(value);
    }

    public <T> T genericMethodWithLocalGenericFunction(T value) {
        class LocalGeneric {
            <L> L localGeneric(L local) {
                return local;
            }
        }
        return new LocalGeneric().localGeneric(value);
    }

    public <E extends Enum<E>> E genericMethodWithEnumConstraint(Class<E> type, String name) {
        return Enum.valueOf(type, name);
    }

    public static class GenericClassWithShadowedParameter<T> {
        public T classValue;

        /** The method's own T hides the class's T. */
        public <T> T genericMethodWithTypeParameterShadowingClassParameter(T value) {
            return value;
        }
    }

    public static class GenericClassWithGenericMethods<C> {
        public C classValue;

        public <M> M methodWithOwnParameter(M value) {
            return value;
        }

        public <M> Map.Entry<C, M> methodMixingClassAndMethodParameters(M value) {
            return new AbstractMap.SimpleEntry<>(classValue, value);
        }

        public <M extends C> M methodWithConstraintReferencingClassParameter(M value) {
            return value;
        }
    }

    public abstract static class GenericVirtualMethods {
        public abstract <T> T abstractGenericMethod(T value);

        public <T extends CharSequence> T virtualGenericMethod(T value) {
            return value;
        }
    }

    public static class GenericVirtualMethodsOverridden extends GenericVirtualMethods {
        @Override
        public <T> T abstractGenericMethod(T value) {
            return value;
        }

        @Override
        public <T extends CharSequence> T virtualGenericMethod(T value) {
            return super.virtualGenericMethod(value);
        }
    }

    public interface GenericMethodsInInterface {
        <T> T method(T value);

        static <T> T staticGenericMethodInInterface(T value) {
            return value;
        }
    }

    public static class GenericMethodsInInterfaceImplementation implements GenericMethodsInInterface {
        @Override
        public <T> T method(T value) {
            return value;
        }
    }

    public static class GenericMethodInvocations {
        public void invokeWithInferredAndExplicitTypeArguments() {
            GenericMethods methods = new GenericMethods();
            int inferred = methods.identity(1);
            int explicitArgument = methods.<Integer>identity(1);
            String twoInferred = methods.genericMethodWithTwoParameters(1, value -> value.toString());
            String twoExplicit = methods.<Integer, String>genericMethodWithTwoParameters(1, value -> value.toString());
            methods.<String>genericMethodWithoutUsingParameterInSignature();
            int viaStatic = GenericMethods.staticGenericMethod(1);
            List<Integer> viaExplicitStatic = GenericMethods.<Integer>listOf(1);
            int viaStaticClass = GenericTypes.GenericStaticClass.<Integer>identity(1);
            int viaInterfaceStatic = GenericMethodsInInterface.staticGenericMethodInInterface(1);
            GenericTypes.GenericClassWithOneParameter<Integer> outer = new GenericTypes.GenericClassWithOneParameter<>();
            GenericTypes.GenericClassWithOneParameter<Integer>.NestedGenericClass<String> closedNested = outer.new NestedGenericClass<String>();
            System.out.println(inferred + explicitArgument + viaStatic + viaStaticClass + viaInterfaceStatic
                    + twoInferred.length() + twoExplicit.length() + viaExplicitStatic.size() + closedNested.map.size());
        }
    }
}
