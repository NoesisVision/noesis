package vision.noesis.fixture.syntax.inheritance;

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
}
