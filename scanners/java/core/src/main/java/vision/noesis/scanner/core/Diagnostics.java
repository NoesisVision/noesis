package vision.noesis.scanner.core;

import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
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
    public static final String RELEASE_NOT_SUPPORTED = "NS1009";
    public static final String FILE_NOT_SCANNED = "NS1010";

    private Diagnostics() {}

    public static Diagnostic error(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.ERROR, code, message, null, DiagnosticSource.SCANNER);
    }

    public static Diagnostic warning(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.WARNING, code, message, null, DiagnosticSource.SCANNER);
    }

    public static Diagnostic error(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.ERROR, code, message, location, DiagnosticSource.SCANNER);
    }

    public static Diagnostic warning(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.WARNING, code, message, location, DiagnosticSource.SCANNER);
    }

    public static Diagnostic info(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.INFO, code, message, location, DiagnosticSource.SCANNER);
    }

    /**
     * The model of a module an engine failed on: the artifact and the {@code NS1001} alone. What the engine had collected
     * before the failure is dropped, since it lacks the namespaces and stubs its edges point at.
     */
    public static CodeModelFile notScanned(ArtifactInput input, ArtifactNode artifact, ScanSession session, String reason) {
        ModelBuilder builder = new ModelBuilder();
        builder.diagnostic(error(MODULE_NOT_SCANNED, "Module " + input.artifactId() + " could not be scanned: " + reason));
        return builder.build(session.generator(), artifact, session);
    }

    /** The failure and where in the scanner it surfaced, so a report is actionable without a stack trace. */
    public static String describe(Throwable e) {
        StringBuilder text = new StringBuilder(e.toString());
        for (StackTraceElement frame : e.getStackTrace()) {
            if (frame.getClassName().startsWith("vision.noesis.")) {
                text.append(" at ").append(frame.getClassName()).append('.').append(frame.getMethodName()).append(':').append(frame.getLineNumber());
                break;
            }
        }
        return text.toString();
    }
}
