package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum StubKind {
    NAMESPACE("namespace"),
    TYPE("type"),
    METHOD("method"),
    PROPERTY("property"),
    FIELD("field");

    private final String id;

    StubKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
