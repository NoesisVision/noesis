package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Passing {
    VALUE("value"),
    REF("ref");

    private final String id;

    Passing(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
