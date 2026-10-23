package vision.noesis.fixture.syntax.inheritance;

import vision.noesis.fixture.syntax.types.InterfaceKinds;

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

    public interface BaseInterface {
        void baseInterfaceMethod();
    }

    public interface SecondBaseInterface {
        void secondBaseInterfaceMethod();
    }

    public interface DerivedInterface extends BaseInterface {
        void derivedInterfaceMethod();
    }

    public interface DerivedFromTwoInterfaces extends BaseInterface, SecondBaseInterface {
    }

    public interface ThirdLevelInterface extends DerivedInterface, DerivedFromTwoInterfaces {
        void thirdLevelMethod();
    }

    public interface DerivedInterfaceHidingMember extends Second {
        /** Re-abstracts the default inherited from Second. */
        @Override
        void first();
    }

    public interface GenericDerivedInterface<T extends Number> extends InterfaceKinds.GenericInterface<T> {
    }

    public interface DerivedFromClosedGenericInterface extends InterfaceKinds.GenericInterface<Integer> {
    }

    public interface DerivedFromFrameworkInterfaces extends AutoCloseable, Comparable<DerivedFromFrameworkInterfaces> {
    }
}
