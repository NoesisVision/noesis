package vision.noesis.scanner.core;

import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.DiagnosticSeverity;
import vision.noesis.scanner.model.DiagnosticSource;
import vision.noesis.scanner.model.SourceSpan;

/** The scanner's own diagnostic codes; compiler diagnostics keep javac's. */
public final class Diagnostics {

    public static final String MODULE_NOT_SCANNED = "NS1001";
    public static final String UNBOUND_SITE = "NS1002";
    public static final String NO_COMPILER = "NS1003";
    public static final String DUPLICATE_ID = "NS1004";
    public static final String CLASSES_MISSING = "NS1005";
    public static final String NO_PARAMETER_NAMES = "NS1006";
    public static final String NOT_FULLY_IMPORTED = "NS1007";
    public static final String PLATFORM_FROM_RUNTIME = "NS1008";

    private Diagnostics() {}

    public static Diagnostic error(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.ERROR, code, message, null, DiagnosticSource.SCANNER);
    }

    public static Diagnostic warning(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.WARNING, code, message, null, DiagnosticSource.SCANNER);
    }

    public static Diagnostic info(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.INFO, code, message, location, DiagnosticSource.SCANNER);
    }
}
