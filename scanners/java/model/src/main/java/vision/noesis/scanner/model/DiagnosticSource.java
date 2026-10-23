package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum DiagnosticSource {
    COMPILER("compiler"),
    SCANNER("scanner");

    private final String id;

    DiagnosticSource(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
