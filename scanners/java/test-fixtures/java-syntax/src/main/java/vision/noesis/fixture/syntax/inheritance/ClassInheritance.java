package vision.noesis.fixture.syntax.inheritance;

import java.util.ArrayList;
import java.util.function.Supplier;
import vision.noesis.fixture.other.OtherAbstractClass;
import vision.noesis.fixture.syntax.types.ClassKinds;

/** Overriding, covariant returns, constructor chaining, implicit super calls, initializer blocks. */
public final class ClassInheritance {

    private ClassInheritance() {
    }

    public static class Base {
        protected int baseField;

        public Base() {
        }

        public Base(int value) {
            baseField = value;
        }

        public void overridable() {
        }

        public Object covariant() {
            return null;
        }

        public final void finalMethod() {
        }

        public static void staticMethod() {
        }

        protected void protectedMethod() {
        }

        void packagePrivateMethod() {
        }

        private void privateMethod() {
        }

        public <T> T virtualGenericMethod(T value) {
            return value;
        }

        public static class NestedTypeToHide {
        }

        @Override
        public String toString() {
            return "Base";
        }

        @Override
        public boolean equals(Object obj) {
            return this == obj;
        }

        @Override
        public int hashCode() {
            return 0;
        }
    }

    public static class Derived extends Base {
        public Derived() {
            super(5);
        }

        public Derived(String text) {
            this();
            baseField = text.length();
        }

        @Override
        public void overridable() {
            super.overridable();
            protectedMethod();
        }

        @Override
        public String covariant() {
            return "derived";
        }

        @Override
        protected void protectedMethod() {
        }

        @Override
        void packagePrivateMethod() {
        }

        @Override
        public <T> T virtualGenericMethod(T value) {
            return super.virtualGenericMethod(value);
        }

        public static class NestedTypeToHide {
        }

        @Override
        public String toString() {
            return super.toString() + "Derived";
        }

        @Override
        public boolean equals(Object obj) {
            return super.equals(obj);
        }

        @Override
        public int hashCode() {
            return super.hashCode();
        }
    }

    public static class ImplicitSuperCall extends Base {
        private int initialised = 1;
        private final int fromBlock;

        {
            fromBlock = initialised + 1;
        }

        public ImplicitSuperCall() {
            initialised = 3;
        }

        public ImplicitSuperCall(int value) {
            this();
            initialised = value;
        }
    }

    public static class GrandChild extends Derived {
    }

    public static class HidingSubclass extends Base {
        public static void staticMethod() {
        }
    }

    public static class DerivedClassHidingField extends Base {
        protected int baseField;

        public int readHidingField() {
            return baseField + super.baseField;
        }
    }

    public static class SecondLevelDerivedClass extends Derived {
        @Override
        public final void overridable() {
        }
    }

    public static class ThirdLevelDerivedClass extends SecondLevelDerivedClass {
    }

    public static final class SealedDerivedClass extends Base {
    }

    public static class DerivedClassWithFinalizer extends Base {
        @Override
        @SuppressWarnings("deprecation")
        protected void finalize() {
        }
    }

    public static class DerivedFromFullyQualifiedName extends vision.noesis.fixture.syntax.inheritance.ClassInheritance.Base {
    }

    public static class DerivedFromFrameworkType extends java.util.AbstractList<Integer> {
        @Override
        public Integer get(int index) {
            return index;
        }

        @Override
        public int size() {
            return 0;
        }
    }

    public static class DerivedFromFrameworkCollection extends ArrayList<Integer> {
    }

    public static class DerivedFromException extends Exception {
        public DerivedFromException() {
        }

        public DerivedFromException(String message) {
            super(message);
        }

        public DerivedFromException(String message, Exception inner) {
            super(message, inner);
        }
    }

    public static class DerivedFromOtherProjectClass extends OtherAbstractClass {
        public DerivedFromOtherProjectClass() {
            super(1);
        }

        @Override
        public int abstractMethodFromOtherModule() {
            return concreteMethodFromOtherModule();
        }
    }

    public static class DerivedFromNestedClass extends ClassKinds.PlainClass {
    }

    public static class OuterClassWithNestedDerivingFromOuter {
        public static class NestedDerivedFromOuter extends OuterClassWithNestedDerivingFromOuter {
        }
    }

    public static class BaseClassWithProtectedConstructorOnly {
        protected BaseClassWithProtectedConstructorOnly() {
        }
    }

    public static class DerivedViaProtectedConstructor extends BaseClassWithProtectedConstructorOnly {
    }

    public static class BaseClassWithStaticMembers {
        public static int staticFieldOnBase;

        public static void staticMethodOnBase() {
        }
    }

    public static class DerivedClassUsingInheritedStatics extends BaseClassWithStaticMembers {
        public int readInheritedStaticField() {
            return staticFieldOnBase;
        }

        public void callInheritedStaticMethod() {
            staticMethodOnBase();
        }
    }

    public static class SelfReferencingGenericBase<S extends SelfReferencingGenericBase<S>> {
        @SuppressWarnings("unchecked")
        public S self() {
            return (S) this;
        }
    }

    public static class DerivedFromSelfReferencingGeneric extends SelfReferencingGenericBase<DerivedFromSelfReferencingGeneric> {
    }

    public static class BaseClassCalledFromDerivedWithBaseKeyword {
        public int compute() {
            return 1;
        }
    }

    public static class DerivedCallingBaseInsideLambda extends BaseClassCalledFromDerivedWithBaseKeyword {
        @Override
        public int compute() {
            Supplier<Integer> viaBase = () -> super.compute();
            return viaBase.get();
        }
    }
}
