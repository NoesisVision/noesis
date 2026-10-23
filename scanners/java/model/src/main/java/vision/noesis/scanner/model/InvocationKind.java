package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum InvocationKind {
    CALL("call"),
    EXTENSION("extension");

    private final String id;

    InvocationKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
