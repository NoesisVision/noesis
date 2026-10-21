package vision.noesis.fixture.syntax.inheritance;

/** How interface members are satisfied: directly, by a default, by a base class member. */
public final class InterfaceInheritance {

    private InterfaceInheritance() {
    }

    public interface First {
        void first();
    }

    public interface Second extends First {
        void second();

        @Override
        default void first() {
        }
    }

    public static class ImplementsSecond implements Second {
        @Override
        public void second() {
        }
    }

    public static class OverridesDefault implements Second {
        @Override
        public void first() {
        }

        @Override
        public void second() {
        }
    }

    public static class BaseProvidesImplementation {
        public void first() {
        }
    }

    public static class DerivedImplementsThroughBase extends BaseProvidesImplementation implements First {
    }

    public static class ImplementsBoth implements First, Runnable {
        @Override
        public void first() {
        }

        @Override
        public void run() {
        }
    }
}
