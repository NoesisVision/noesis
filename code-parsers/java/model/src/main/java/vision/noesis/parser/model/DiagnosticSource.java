package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum DiagnosticSource {
    COMPILER("compiler"),
    PARSER("parser");

    private final String id;

    DiagnosticSource(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
