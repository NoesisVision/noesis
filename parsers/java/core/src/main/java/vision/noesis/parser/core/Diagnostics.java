package vision.noesis.parser.core;

import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.DiagnosticSource;
import vision.noesis.parser.model.SourceSpan;

/** The parser's own diagnostic codes; compiler diagnostics keep javac's. */
public final class Diagnostics {

    public static final String MODULE_NOT_PARSED = "NS1001";
    public static final String UNBOUND_SITE = "NS1002";
    public static final String NO_COMPILER = "NS1003";
    public static final String DUPLICATE_ID = "NS1004";
    public static final String CLASSES_MISSING = "NS1005";
    public static final String NO_PARAMETER_NAMES = "NS1006";
    public static final String NOT_FULLY_IMPORTED = "NS1007";
    public static final String PLATFORM_FROM_RUNTIME = "NS1008";
    public static final String RELEASE_NOT_SUPPORTED = "NS1009";
    public static final String FILE_NOT_PARSED = "NS1010";

    private Diagnostics() {}

    public static Diagnostic error(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.ERROR, code, message, null, DiagnosticSource.PARSER);
    }

    public static Diagnostic warning(String code, String message) {
        return new Diagnostic(DiagnosticSeverity.WARNING, code, message, null, DiagnosticSource.PARSER);
    }

    public static Diagnostic error(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.ERROR, code, message, location, DiagnosticSource.PARSER);
    }

    public static Diagnostic warning(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.WARNING, code, message, location, DiagnosticSource.PARSER);
    }

    public static Diagnostic info(String code, String message, SourceSpan location) {
        return new Diagnostic(DiagnosticSeverity.INFO, code, message, location, DiagnosticSource.PARSER);
    }

    /**
     * The model of a module an engine failed on: the artifact and the {@code NS1001} alone. What the engine had collected
     * before the failure is dropped, since it lacks the namespaces and stubs its edges point at.
     */
    public static CodeModelFile notParsed(ArtifactInput input, ArtifactNode artifact, ParseSession session, String reason) {
        ModelBuilder builder = new ModelBuilder();
        builder.diagnostic(error(MODULE_NOT_PARSED, "Module " + input.artifactId() + " could not be parsed: " + reason));
        return builder.build(session.generator(), artifact, session);
    }

    /** The failure and where in the parser it surfaced, so a report is actionable without a stack trace. */
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
