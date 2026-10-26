package vision.noesis.fixture.syntax.inheritance;

/** Abstract classes: abstract and template methods, re-abstraction in an intermediate class, a protected base constructor. */
public final class AbstractInheritance {

    private AbstractInheritance() {
    }

    public abstract static class AbstractBase {
        public abstract void run();

        protected void helper() {
        }

        public void template() {
            run();
            helper();
        }
    }

    public static class Concrete extends AbstractBase {
        @Override
        public void run() {
            helper();
        }
    }

    public abstract static class AbstractBaseWithAllMemberKinds {
        public abstract void abstractMethod();

        protected abstract void protectedAbstractMethod();

        public void virtualMethodWithDefaultBody() {
        }

        public abstract <T> T abstractGenericMethod(T value);
    }

    public abstract static class AbstractIntermediate extends AbstractBaseWithAllMemberKinds {
        @Override
        public void abstractMethod() {
        }

        /** Re-abstracts an inherited concrete method. */
        @Override
        public abstract void virtualMethodWithDefaultBody();
    }

    public static class ConcreteFromAbstractIntermediate extends AbstractIntermediate {
        @Override
        protected void protectedAbstractMethod() {
        }

        @Override
        public void virtualMethodWithDefaultBody() {
        }

        @Override
        public <T> T abstractGenericMethod(T value) {
            return value;
        }
    }

    public abstract static class AbstractClassWithConstructor {
        private final int value;

        protected AbstractClassWithConstructor(int value) {
            this.value = value;
        }

        public int value() {
            return value;
        }
    }

    public static class ConcreteCallingAbstractConstructor extends AbstractClassWithConstructor {
        public ConcreteCallingAbstractConstructor() {
            super(1);
        }
    }
}
