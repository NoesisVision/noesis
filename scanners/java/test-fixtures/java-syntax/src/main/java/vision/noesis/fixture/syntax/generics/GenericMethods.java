package vision.noesis.fixture.syntax.generics;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

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
}
