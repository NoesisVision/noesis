package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum DiagnosticSeverity {
    ERROR("error"),
    WARNING("warning"),
    INFO("info");

    private final String id;

    DiagnosticSeverity(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
