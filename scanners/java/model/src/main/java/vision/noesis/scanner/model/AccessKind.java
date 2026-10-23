package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum AccessKind {
    READ("read"),
    WRITE("write"),
    READ_WRITE("readWrite");

    private final String id;

    AccessKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
