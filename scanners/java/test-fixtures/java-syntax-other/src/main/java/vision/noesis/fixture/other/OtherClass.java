package vision.noesis.fixture.other;

/** A class from another module of the build: referenced, never stubbed. */
public class OtherClass {

    public int value;

    public OtherClass() {
    }

    public OtherClass(int value) {
        this.value = value;
    }

    public static OtherClass create() {
        return new OtherClass(1);
    }

    public int value() {
        return value;
    }
}
