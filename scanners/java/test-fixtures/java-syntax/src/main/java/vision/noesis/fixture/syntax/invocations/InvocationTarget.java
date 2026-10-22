package vision.noesis.fixture.syntax.invocations;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.Supplier;
import vision.noesis.fixture.syntax.inheritance.ClassInheritance;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** The class every invocation form targets: instance, generic, static, nested and functional members. */
public class InvocationTarget {

    public InvocationTarget fieldHoldingSelf;

    public Supplier<Integer> supplierField = () -> 1;

    public Function<Integer, Integer> functionField = value -> value;

    public static InvocationTarget STATIC_FIELD = new InvocationTarget();

    public InvocationTarget() {
        fieldHoldingSelf = this;
    }

    public InvocationTarget(int ignored) {
        this();
    }

    public int instanceMethod() {
        return 1;
    }

    public int instanceMethodWithArguments(int first) {
        return first;
    }

    public int instanceMethodWithArguments(int first, String second, int... rest) {
        return first + second.length() + rest.length;
    }

    public <T> T genericInstanceMethod(T value) {
        return value;
    }

    public InvocationTarget returnsSelf() {
        return this;
    }

    public int[] returnsArray() {
        return new int[]{1};
    }

    public List<InvocationTarget> returnsList() {
        return List.of(this);
    }

    public Supplier<Integer> returnsSupplier() {
        return this::instanceMethod;
    }

    public Function<Integer, Function<Integer, Integer>> returnsCurried() {
        return first -> second -> first + second;
    }

    public CompletableFuture<InvocationTarget> returnsFuture() {
        return CompletableFuture.completedFuture(this);
    }

    public static int staticMethod() {
        return 1;
    }

    public static <T> T staticGenericMethod(T value) {
        return value;
    }

    public static InvocationTarget staticFactory() {
        return new InvocationTarget();
    }

    @Override
    public String toString() {
        return "InvocationTarget";
    }

    public static class NestedStaticHolder {

        public static int nestedStaticMethod() {
            return 1;
        }

        public static class DoublyNested {

            public static int doublyNestedStaticMethod() {
                return 1;
            }
        }
    }

    public static class InvocationDerived extends ClassInheritance.Base implements InterfaceKinds.PlainInterface {

        public InvocationDerived() {
        }

        public InvocationDerived(String text) {
            super(text.length());
        }

        @Override
        public void overridable() {
            super.overridable();
        }

        @Override
        public void abstractMethod() {
        }

        public void callProtectedBase() {
            protectedMethod();
        }
    }

    public static final class GenericStaticClassForInvocations<T> {

        private GenericStaticClassForInvocations() {
        }

        public static int staticOnGenericClass() {
            return 1;
        }

        public static class NestedInstantiable {
        }
    }
}
