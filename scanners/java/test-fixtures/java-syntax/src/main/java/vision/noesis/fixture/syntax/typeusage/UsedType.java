package vision.noesis.fixture.syntax.typeusage;

/** The own-module type every position in OwnModuleTypeUsage refers to. */
public class UsedType {

    public static final int CONSTANT = 42;

    public static final UsedType DEFAULT = new UsedType();

    public UsedType() {
    }

    public UsedType(double value) {
    }

    public static UsedType create() {
        return new UsedType(1.0);
    }

    public double get() {
        return 0;
    }

    /** A nested type of the own-module type, reached by its qualified name. */
    public static class Nested {

        public int nestedValue() {
            return 2;
        }
    }
}
