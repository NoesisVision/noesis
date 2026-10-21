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
}
