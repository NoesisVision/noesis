package vision.noesis.fixture.other;

/** An abstract class from another module: a base to extend and a method to override across the boundary. */
public abstract class OtherAbstractClass {

    protected OtherAbstractClass() {
    }

    protected OtherAbstractClass(int seed) {
        this.seed = seed;
    }

    protected int seed;

    public abstract int abstractMethodFromOtherModule();

    public int concreteMethodFromOtherModule() {
        return seed;
    }
}
