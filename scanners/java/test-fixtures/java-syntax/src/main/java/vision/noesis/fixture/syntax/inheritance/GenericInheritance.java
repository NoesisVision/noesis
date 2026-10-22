package vision.noesis.fixture.syntax.inheritance;

import com.google.common.base.Converter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import vision.noesis.fixture.other.OtherClass;
import vision.noesis.fixture.other.OtherGeneric;
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

    public static class GenericBaseClass<T> {
        public T genericValue;

        public T genericVirtualMethod(T value) {
            return value;
        }
    }

    public static class DerivedFromClosedGenericBase extends GenericBaseClass<Integer> {
        @Override
        public Integer genericVirtualMethod(Integer value) {
            return value + 1;
        }
    }

    public static class DerivedFromOpenGenericBase<T> extends GenericBaseClass<T> {
        @Override
        public T genericVirtualMethod(T value) {
            return super.genericVirtualMethod(value);
        }
    }

    public static class DerivedFromOpenGenericBaseWithRenamedParameter<R> extends GenericBaseClass<R> {
    }

    public static class DerivedFromGenericBaseWithConstraint<T extends Number> extends GenericBaseClass<T> {
    }

    public static class DerivedFromGenericBaseWithExtraParameter<A, B> extends GenericBaseClass<A> {
        public B secondValue;
    }

    public static class DerivedFromNestedClosedGenericBase extends GenericBaseClass<List<Map<String, int[]>>> {
    }

    public static class DerivedFromGenericBaseWithArrayArgument extends GenericBaseClass<String[]> {
    }

    public static class DerivedFromGenericBaseOfOtherProjectType extends GenericBaseClass<OtherClass> {
    }

    public static class DerivedFromOtherProjectGenericClass extends OtherGeneric<String> {
        @Override
        public String item() {
            return super.item();
        }
    }

    public static class DerivedFromFrameworkGenericClass extends ArrayList<Integer> {
    }

    public static class DerivedFromFrameworkGenericClassWithOwnParameter<T> extends HashMap<String, T> {
    }

    public abstract static class GenericAbstractBase<T> {
        public abstract T create();
    }

    public static class ConcreteFromGenericAbstract extends GenericAbstractBase<String> {
        @Override
        public String create() {
            return "";
        }
    }

    public static class GenericClassWithNestedDerivedClass<T> {
        /** An inner class is the only nested kind that can name the outer's T. */
        public class NestedDerivedFromGenericOuter extends GenericClassWithNestedDerivedClass<T> {
        }

        public static class NestedDerivedFromClosedGenericOuter extends GenericClassWithNestedDerivedClass<Integer> {
        }
    }
}
