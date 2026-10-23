package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Modifier {
    STATIC("static"),
    ABSTRACT("abstract"),
    FINAL("final"),
    VIRTUAL("virtual"),
    HIDING("hiding"),
    READONLY("readonly"),
    RECORD("record"),
    VOLATILE("volatile"),
    ASYNC("async"),
    EXTERNAL("external");

    private final String id;

    Modifier(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
