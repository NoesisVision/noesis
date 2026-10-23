package vision.noesis.scanner.model;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Lays the manifest and the model files out under the output root: {@code code-model/<language>/}. */
public final class CodeModelWriter {

    public static final String MANIFEST_FILE_NAME = "manifest.json";

    private CodeModelWriter() {}

    public static String languageDirectory(Language language) {
        return "code-model/" + language.id();
    }

    /** Path of an artifact's model file relative to the output root, with forward slashes, as the manifest lists it. */
    public static String artifactFile(Language language, String artifactName) {
        return languageDirectory(language) + "/" + safeFileName(artifactName) + ".code-model.json";
    }

    public static String manifestFile(Language language) {
        return languageDirectory(language) + "/" + MANIFEST_FILE_NAME;
    }

    public static void writeModel(Path outputRoot, String relativeFile, CodeModelFile model) throws IOException {
        write(outputRoot.resolve(relativeFile), CodeModelJson.serialize(model));
    }

    public static void writeManifest(Path outputRoot, ScanManifest manifest) throws IOException {
        write(outputRoot.resolve(manifestFile(manifest.language())), CodeModelJson.serialize(manifest));
    }

    private static void write(Path file, String json) throws IOException {
        Files.createDirectories(file.getParent());
        Files.writeString(file, json, StandardCharsets.UTF_8);
    }

    private static String safeFileName(String name) {
        StringBuilder safe = new StringBuilder(name.length());
        for (char c : name.toCharArray()) {
            safe.append("/\\:*?\"<>|".indexOf(c) >= 0 || c < 0x20 ? '_' : c);
        }
        return safe.toString();
    }
}
