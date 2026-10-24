package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Visibility {
    PUBLIC("public"),
    PROTECTED("protected"),
    PRIVATE("private"),
    ARTIFACT("artifact"),
    NAMESPACE("namespace"),
    FILE("file"),
    PROTECTED_OR_ARTIFACT("protectedOrArtifact"),
    PROTECTED_AND_ARTIFACT("protectedAndArtifact"),
    PROTECTED_OR_NAMESPACE("protectedOrNamespace");

    private final String id;

    Visibility(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
