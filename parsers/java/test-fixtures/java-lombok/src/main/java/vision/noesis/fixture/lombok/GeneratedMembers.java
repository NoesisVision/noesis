package vision.noesis.fixture.lombok;

import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.IntFunction;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.Value;
import lombok.With;
import lombok.experimental.Accessors;
import lombok.experimental.Delegate;

/** One nested class per Lombok feature; the member each one generates is what the source engine lacks. */
public final class GeneratedMembers {

    private GeneratedMembers() {
    }

    /** {@code getName()}, {@code getCount()}, {@code setName(String)}, {@code setCount(int)}. */
    @Getter
    @Setter
    public static class GetterSetter {

        private String name;
        private int count;

        /** A written method beside the generated ones: declared in both engines. */
        public String describe() {
            return name + count;
        }
    }

    /** Accessors, {@code equals}, {@code hashCode}, {@code toString} and the required-arguments constructor. */
    @Data
    public static class DataHolder {

        private final String name;
        private int count;
    }

    /** An immutable class: private final fields, getters, the all-arguments constructor, {@code equals}, {@code hashCode}, {@code toString}. */
    @Value
    public static class ValueHolder {

        String name;
        int count;
    }

    /** {@code builder()}, the nested {@code Builder} class with a method per field, {@code build()} and {@code toBuilder()}. */
    @Builder(toBuilder = true)
    @Getter
    public static class Built {

        private final String name;
        private final int count;
    }

    /** Three generated constructors. */
    @AllArgsConstructor
    @NoArgsConstructor(force = true)
    @RequiredArgsConstructor
    @Getter
    public static class Constructed {

        private final String name;
        private int count;
    }

    /** {@code withName(String)} and {@code withCount(int)} returning a copy. */
    @With
    @AllArgsConstructor
    @Getter
    public static class Withers {

        private final String name;
        private final int count;
    }

    /** Fluent, chaining accessors: {@code name()} reads, {@code name(String)} writes and returns {@code this}. */
    @Getter
    @Setter
    @Accessors(fluent = true, chain = true)
    public static class FluentAccessors {

        private String name;
        private int count;
    }

    /** Explicit {@code equals}, {@code hashCode} and {@code toString} with an excluded field. */
    @EqualsAndHashCode(exclude = "count")
    @ToString(exclude = "count")
    @Getter
    @AllArgsConstructor
    public static class Compared {

        private final String name;
        private final int count;
    }

    /** Every method of {@code List<String>} delegated to the field: generated implementations of the interface's members, which javac alone cannot see the class implements. */
    public static class Delegating implements List<String> {

        @Delegate(excludes = DefaultMethodsWithParameters.class)
        private final List<String> items;

        public Delegating(List<String> items) {
            this.items = items;
        }

        /**
         * The interface's default methods that take parameters, left out of the delegation. Lombok copies the
         * parameter names javac reads: the JDK's own class files name them on JDK 17, while the stripped signatures
         * {@code --release 17} reads on a later JDK do not, so the generated members would differ by the JDK that
         * compiled the fixture.
         */
        private interface DefaultMethodsWithParameters {

            void forEach(Consumer<? super String> action);

            boolean removeIf(Predicate<? super String> filter);

            void replaceAll(UnaryOperator<String> operator);

            void sort(Comparator<? super String> c);

            <T> T[] toArray(IntFunction<T[]> generator);
        }
    }

    /** No Lombok at all: identical in every engine. */
    public static class Plain {

        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
