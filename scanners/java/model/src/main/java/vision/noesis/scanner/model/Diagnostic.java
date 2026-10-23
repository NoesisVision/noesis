package vision.noesis.scanner.model;

import java.util.Comparator;

public record Diagnostic(DiagnosticSeverity severity, String code, String message, SourceSpan location, DiagnosticSource source) {

    public static final Comparator<Diagnostic> ORDER = Comparator
            .comparing(Diagnostic::location, SourceSpan.NULLS_FIRST)
            .thenComparing(Diagnostic::code)
            .thenComparing(Diagnostic::message);
}
