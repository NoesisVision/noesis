package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Flat, scalar, language-prefixed facts ({@code java.throws}, {@code csharp.partial}): a string, a number, a boolean
 * or a list of strings per key, keys in ordinal order.
 */
public final class LanguageBag {

    public static final LanguageBag EMPTY = new LanguageBag(Collections.emptySortedMap());

    private final Map<String, Object> entries;

    private LanguageBag(Map<String, Object> entries) {
        this.entries = entries;
    }

    @JsonCreator
    public static LanguageBag of(Map<String, ?> entries) {
        if (entries.isEmpty()) return EMPTY;
        TreeMap<String, Object> sorted = new TreeMap<>();
        entries.forEach((key, value) -> sorted.put(key, normalise(key, value)));
        return new LanguageBag(Collections.unmodifiableMap(sorted));
    }

    @JsonValue
    public Map<String, Object> entries() {
        return entries;
    }

    public boolean isEmpty() {
        return entries.isEmpty();
    }

    public Object get(String key) {
        return entries.get(key);
    }

    private static Object normalise(String key, Object value) {
        if (value instanceof Integer || value instanceof Short || value instanceof Byte) return ((Number) value).longValue();
        if (value instanceof Float) return ((Number) value).doubleValue();
        if (value instanceof String || value instanceof Boolean || value instanceof Long || value instanceof Double) return value;
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof String)) throw invalid(key, value);
            }
            return List.copyOf(list);
        }
        if (value instanceof String[] array) return List.of(array);
        throw invalid(key, value);
    }

    private static IllegalArgumentException invalid(String key, Object value) {
        return new IllegalArgumentException("A language bag value must be a string, number, boolean or string list; '" + key + "' is " + value.getClass().getSimpleName() + ".");
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof LanguageBag bag && entries.equals(bag.entries);
    }

    @Override
    public int hashCode() {
        return entries.hashCode();
    }

    @Override
    public String toString() {
        return entries.toString();
    }
}
