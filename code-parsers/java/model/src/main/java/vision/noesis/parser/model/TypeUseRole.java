package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum TypeUseRole {
    CREATION("creation"),
    CAST("cast"),
    TYPE_TEST("typeTest");

    private final String id;

    TypeUseRole(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
