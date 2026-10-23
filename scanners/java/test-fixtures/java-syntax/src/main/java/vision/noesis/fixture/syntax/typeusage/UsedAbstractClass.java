package vision.noesis.fixture.syntax.typeusage;

/** An own-module abstract class: a base to extend and a method to override. */
public abstract class UsedAbstractClass {

    protected int seed;

    protected UsedAbstractClass() {
    }

    protected UsedAbstractClass(int seed) {
        this.seed = seed;
    }

    public abstract int abstractMethodInAbstractClass();

    public int concreteMethodInAbstractClass() {
        return seed;
    }
}
