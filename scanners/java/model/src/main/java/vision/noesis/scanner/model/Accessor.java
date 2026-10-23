package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Accessor {
    GET("get"),
    SET("set"),
    INIT("init"),
    ADD("add"),
    REMOVE("remove");

    private final String id;

    Accessor(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
