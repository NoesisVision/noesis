package vision.noesis.fixture.syntax.inheritance;

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
}
