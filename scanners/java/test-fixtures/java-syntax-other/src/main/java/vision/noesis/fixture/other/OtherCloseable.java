package vision.noesis.fixture.other;

/** A resource from another module, for try-with-resources across the boundary. */
public class OtherCloseable implements AutoCloseable {

    @Override
    public void close() {
    }
}
