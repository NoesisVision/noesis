package vision.noesis.fixture.syntax.types;

import java.util.List;

/** Records: plain, compact constructor, explicit accessor, generic, implementing an interface. */
public final class RecordKinds {

    private RecordKinds() {
    }

    public record PlainRecord(int id, String name) {}

    public record RecordWithCompactConstructor(String value) {
        public RecordWithCompactConstructor {
            value = value.trim();
        }
    }

    public record RecordWithExplicitMembers(int count) {
        public static final RecordWithExplicitMembers ZERO = new RecordWithExplicitMembers(0);

        @Override
        public int count() {
            return count;
        }

        public RecordWithExplicitMembers increment() {
            return new RecordWithExplicitMembers(count + 1);
        }
    }

    public record GenericRecord<T>(T item, List<T> rest) {}

    public record RecordImplementingInterface(String text) implements InterfaceKinds.GenericInterface<String> {
        @Override
        public String get() {
            return text;
        }

        @Override
        public void put(String value) {
        }
    }

    public record RecordWithBodyOnly() {
        public static final RecordWithBodyOnly INSTANCE = new RecordWithBodyOnly();

        public int initOnlyProperty() {
            return 1;
        }
    }

    public record RecordWithPositionalAndBodyMembers(int positional, int nonPositional) {
        public RecordWithPositionalAndBodyMembers(int positional) {
            this(positional, 0);
        }

        public int computed() {
            return positional + nonPositional;
        }
    }

    public record RecordWithExplicitToString(int value) {
        @Override
        public String toString() {
            return "RecordWithExplicitToString(" + value + ")";
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof RecordWithExplicitToString that && that.value == value;
        }

        @Override
        public int hashCode() {
            return Integer.hashCode(value);
        }
    }

    public record GenericRecordWithTwoParameters<TFirst, TSecond>(TFirst first, TSecond second) {}

    record InternalRecord() {}

    public sealed interface SealedRecordBase permits RecordImplementingSealedInterface {
        int value();
    }

    public record RecordImplementingSealedInterface(int value) implements SealedRecordBase {}

    public record RecordWithExplicitCanonicalConstructor(int value) {
        public RecordWithExplicitCanonicalConstructor(int value) {
            this.value = Math.max(value, 0);
        }
    }

    public record RecordWithVarargsComponent(int... values) {}

    public record RecordWithNestedRecord(int outerValue) {
        public record NestedRecordInRecord(int innerValue) {}
    }
}
