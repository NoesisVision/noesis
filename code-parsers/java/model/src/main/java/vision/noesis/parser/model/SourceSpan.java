package vision.noesis.parser.model;

import java.util.Comparator;

/** Repository-relative, forward-slash file; 1-based lines and columns; a bytecode-only location has line and column 0. */
public record SourceSpan(String file, int startLine, int startColumn, int endLine, int endColumn) implements Comparable<SourceSpan> {

    private static final Comparator<SourceSpan> ORDER = Comparator
            .comparing(SourceSpan::file)
            .thenComparingInt(SourceSpan::startLine)
            .thenComparingInt(SourceSpan::startColumn)
            .thenComparingInt(SourceSpan::endLine)
            .thenComparingInt(SourceSpan::endColumn);

    /** Nulls first, as the .NET parser sorts diagnostics without a location. */
    public static final Comparator<SourceSpan> NULLS_FIRST = Comparator.nullsFirst(ORDER);

    @Override
    public int compareTo(SourceSpan other) {
        return ORDER.compare(this, other);
    }
}
