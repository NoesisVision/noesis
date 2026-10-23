package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum TypeKind {
    CLASS("class"),
    INTERFACE("interface"),
    STRUCT("struct"),
    ENUM("enum"),
    DELEGATE("delegate"),
    TRAIT("trait"),
    TYPE_ALIAS("typeAlias");

    private final String id;

    TypeKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
