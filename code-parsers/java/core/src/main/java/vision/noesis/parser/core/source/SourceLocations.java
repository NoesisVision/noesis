package vision.noesis.parser.core.source;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.LineMap;
import com.sun.source.tree.Tree;
import com.sun.source.util.SourcePositions;
import java.net.URI;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import javax.tools.Diagnostic;
import vision.noesis.parser.model.SourceSpan;

/** Source spans with repository-relative paths and 1-based lines and columns, from javac's positions. */
final class SourceLocations {

    private final SourceContext context;
    private final SourcePositions positions;
    private final Map<URI, String> files = new HashMap<>();

    SourceLocations(SourceContext context) {
        this.context = context;
        this.positions = context.javac.trees().getSourcePositions();
    }

    String fileOf(CompilationUnitTree unit) {
        return files.computeIfAbsent(unit.getSourceFile().toUri(), uri -> context.session.locations().relativePath(Path.of(uri)));
    }

    /** The whole tree; a tree without an end position (one javac synthesised) spans nothing at its start. */
    SourceSpan spanOf(CompilationUnitTree unit, Tree tree) {
        long start = positions.getStartPosition(unit, tree);
        long end = positions.getEndPosition(unit, tree);
        if (start == Diagnostic.NOPOS) return null;
        if (end == Diagnostic.NOPOS) end = start;
        return span(unit, start, end);
    }

    /** A zero-width span at the tree's start: where something implicit belongs. */
    SourceSpan startOf(CompilationUnitTree unit, Tree tree) {
        long start = positions.getStartPosition(unit, tree);
        return start == Diagnostic.NOPOS ? null : span(unit, start, start);
    }

    SourceSpan span(CompilationUnitTree unit, long start, long end) {
        LineMap lines = unit.getLineMap();
        long startLine = lines.getLineNumber(start);
        long endLine = lines.getLineNumber(end);
        return new SourceSpan(fileOf(unit), (int) startLine, column(lines, startLine, start), (int) endLine, column(lines, endLine, end));
    }

    /** Characters from the line's start, as the other parsers count: {@link LineMap#getColumnNumber} expands tabs to stops of 8. */
    private static int column(LineMap lines, long line, long position) {
        return (int) (position - lines.getStartPosition(line) + 1);
    }

    boolean hasPosition(CompilationUnitTree unit, Tree tree) {
        return positions.getStartPosition(unit, tree) != Diagnostic.NOPOS;
    }

    /** Whether javac synthesised the tree: it has no end position, or the source at its start does not spell it. */
    boolean isSynthetic(CompilationUnitTree unit, Tree tree, String sourceText, String expectedStart) {
        long start = positions.getStartPosition(unit, tree);
        if (start == Diagnostic.NOPOS) return true;
        if (positions.getEndPosition(unit, tree) == Diagnostic.NOPOS) return true;
        return !sourceText.startsWith(expectedStart, (int) start);
    }
}
