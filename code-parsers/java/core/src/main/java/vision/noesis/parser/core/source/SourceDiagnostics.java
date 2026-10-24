package vision.noesis.parser.core.source;

import com.sun.source.tree.CompilationUnitTree;
import java.util.Locale;
import javax.tools.Diagnostic;
import javax.tools.JavaFileObject;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.DiagnosticSource;
import vision.noesis.parser.model.SourceSpan;

/** javac's diagnostics as the model's: javac's own codes, English messages, spans through the unit's line map. */
final class SourceDiagnostics {

    private SourceDiagnostics() {}

    static void addAll(SourceContext context) {
        for (Diagnostic<? extends JavaFileObject> diagnostic : context.javac.diagnostics()) {
            context.builder.diagnostic(new vision.noesis.parser.model.Diagnostic(
                    severity(diagnostic.getKind()),
                    diagnostic.getCode() == null ? "javac" : diagnostic.getCode(),
                    diagnostic.getMessage(Locale.ENGLISH),
                    location(context, diagnostic),
                    DiagnosticSource.COMPILER));
        }
    }

    private static DiagnosticSeverity severity(Diagnostic.Kind kind) {
        switch (kind) {
            case ERROR: return DiagnosticSeverity.ERROR;
            case WARNING: case MANDATORY_WARNING: return DiagnosticSeverity.WARNING;
            default: return DiagnosticSeverity.INFO;
        }
    }

    private static SourceSpan location(SourceContext context, Diagnostic<? extends JavaFileObject> diagnostic) {
        JavaFileObject source = diagnostic.getSource();
        if (source == null || diagnostic.getPosition() == Diagnostic.NOPOS) return null;
        CompilationUnitTree unit = context.javac.unitOf(source.toUri());
        if (unit == null) return null;
        long start = diagnostic.getStartPosition();
        long end = diagnostic.getEndPosition();
        if (start == Diagnostic.NOPOS) start = diagnostic.getPosition();
        if (end == Diagnostic.NOPOS || end < start) end = start;
        return context.locations.span(unit, start, end);
    }
}
