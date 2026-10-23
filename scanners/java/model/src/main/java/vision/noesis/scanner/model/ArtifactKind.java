package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ArtifactKind {
    SOURCE("source"),
    LIBRARY("library"),
    PLATFORM("platform");

    private final String id;

    ArtifactKind(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
