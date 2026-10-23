package vision.noesis.parser.core;

import java.nio.file.Path;
import java.util.List;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.ParseManifest;

/** The manifest and models of one parse, as written. */
public record ParseResult(ParseManifest manifest, List<CodeModelFile> models, Path outputDirectory) {

    public Path manifestPath() {
        return outputDirectory.resolve(CodeModelWriter.manifestFile(manifest.language()));
    }

    public CodeModelFile model(String artifactName) {
        return models.stream().filter(model -> model.artifact().name().equals(artifactName)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No model for artifact " + artifactName));
    }
}
