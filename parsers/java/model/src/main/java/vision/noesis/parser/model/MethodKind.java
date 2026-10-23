package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum MethodKind {
    METHOD("method"),
    CONSTRUCTOR("constructor"),
    STATIC_INITIALIZER("staticInitializer"),
    DESTRUCTOR("destructor"),
    OPERATOR("operator"),
    FUNCTION("function");

    private final String id;

    MethodKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
