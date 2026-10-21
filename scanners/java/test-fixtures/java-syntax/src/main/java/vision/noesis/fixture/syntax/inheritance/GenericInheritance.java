package vision.noesis.fixture.syntax.inheritance;

import java.util.ArrayList;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** Generic interfaces implemented with a concrete argument, and an external generic base class. */
public final class GenericInheritance {

    private GenericInheritance() {
    }

    public static final class Money implements Comparable<Money> {
        private final long cents;

        public Money(long cents) {
            this.cents = cents;
        }

        @Override
        public int compareTo(Money other) {
            return Long.compare(cents, other.cents);
        }
    }

    public static class StringBox implements InterfaceKinds.GenericInterface<String> {
        private String content;

        @Override
        public String get() {
            return content;
        }

        @Override
        public void put(String value) {
            content = value;
        }
    }

    public static class ReusableBox<T> implements InterfaceKinds.GenericInterface<T> {
        private T content;

        @Override
        public T get() {
            return content;
        }

        @Override
        public void put(T value) {
            content = value;
        }
    }

    public static class NamesList extends ArrayList<String> {
        private static final long serialVersionUID = 1L;

        @Override
        public boolean add(String name) {
            return super.add(name.trim());
        }
    }
}
