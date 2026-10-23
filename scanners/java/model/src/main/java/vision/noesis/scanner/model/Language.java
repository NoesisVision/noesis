package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonValue;

/** LSP language identifiers; the manifest names the language of the whole scan. */
public enum Language {
    CSHARP("csharp"),
    JAVA("java"),
    TYPESCRIPT("typescript"),
    PHP("php");

    private final String id;

    Language(String id) {
        this.id = id;
    }

    @JsonValue
    public String id() {
        return id;
    }
}
