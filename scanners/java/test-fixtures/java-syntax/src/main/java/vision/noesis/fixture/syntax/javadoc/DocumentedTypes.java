package vision.noesis.fixture.syntax.javadoc;

/**
 * A documented class with {@code inline code}, a {@link DocumentedTypes#documented(int) link}, an entity &amp; and
 * <p>
 * a second paragraph.
 *
 * @since 1.0
 */
public class DocumentedTypes {

    /** A documented field. */
    public int documentedField;

    public int undocumentedField;

    /**
     * A documented method.
     *
     * @param value the value
     * @return the value doubled
     */
    public int documented(int value) {
        return value * 2;
    }

    public int undocumented() {
        return 0;
    }

    // Not a doc comment.
    public int lineCommented() {
        return 1;
    }

    /** Documented nested. */
    public static class Nested {
    }
}
