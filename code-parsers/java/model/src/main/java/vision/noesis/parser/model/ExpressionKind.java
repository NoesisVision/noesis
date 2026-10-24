package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ExpressionKind {
    THIS("this"),
    BASE("base"),
    TYPE_PARAMETER("typeParameter"),
    PARAMETER("parameter"),
    LOCAL("local"),
    FIELD("field"),
    PROPERTY("property"),
    RETURN_VALUE("returnValue"),
    TYPE("type"),
    CREATION("creation"),
    LITERAL("literal"),
    OTHER("other");

    private final String id;

    ExpressionKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
