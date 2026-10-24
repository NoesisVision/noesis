package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Origin {
    DECLARED("declared"),
    GENERATED("generated");

    private final String id;

    Origin(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
