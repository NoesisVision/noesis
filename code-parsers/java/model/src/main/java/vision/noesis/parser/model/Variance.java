package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Variance {
    INVARIANT("invariant"),
    COVARIANT("covariant"),
    CONTRAVARIANT("contravariant");

    private final String id;

    Variance(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
