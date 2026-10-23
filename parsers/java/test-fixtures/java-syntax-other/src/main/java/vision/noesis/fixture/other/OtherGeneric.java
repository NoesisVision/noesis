package vision.noesis.fixture.other;

/** A generic class from another module, to be closed and extended from the syntax module. */
public class OtherGeneric<T> {

    private T item;

    public T item() {
        return item;
    }

    public void item(T value) {
        this.item = value;
    }
}
