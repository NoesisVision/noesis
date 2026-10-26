package vision.noesis.fixture.other;

/** A utility class from another module: a compile-time constant and a static method. */
public final class OtherConstants {

    public static final int CONSTANT = 42;
    public static final String TEXT = "other";

    private OtherConstants() {
    }

    public static int staticMethodFromOtherModule() {
        return CONSTANT;
    }
}
