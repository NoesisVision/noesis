namespace Noesis.Scanner.Model;

public sealed record Diagnostic(
    DiagnosticSeverity Severity,
    string Code,
    string Message,
    SourceSpan? Location,
    DiagnosticSource Source);