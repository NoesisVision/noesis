package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum FieldKind {
    FIELD("field"),
    ENUM_MEMBER("enumMember");

    private final String id;

    FieldKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
