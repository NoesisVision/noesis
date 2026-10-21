package vision.noesis.fixture.syntax.inheritance;

import com.google.common.base.Converter;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** Generic interfaces implemented with a concrete argument, and an external generic base class from a library (the JDK's own classes change between releases). */
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

    /** An external generic base class from a library: its interface slots are filled by inherited members. */
    public static class LengthConverter extends Converter<String, Integer> {
        @Override
        protected Integer doForward(String text) {
            return text.length();
        }

        @Override
        protected String doBackward(Integer length) {
            return "x".repeat(length);
        }
    }
}
