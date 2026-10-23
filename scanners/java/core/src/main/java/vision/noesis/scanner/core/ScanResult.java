package vision.noesis.scanner.core;

import java.nio.file.Path;
import java.util.List;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.CodeModelWriter;
import vision.noesis.scanner.model.ScanManifest;

/** The manifest and models of one scan, as written. */
public record ScanResult(ScanManifest manifest, List<CodeModelFile> models, Path outputDirectory) {

    public Path manifestPath() {
        return outputDirectory.resolve(CodeModelWriter.manifestFile(manifest.language()));
    }

    public CodeModelFile model(String artifactName) {
        return models.stream().filter(model -> model.artifact().name().equals(artifactName)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No model for artifact " + artifactName));
    }
}
