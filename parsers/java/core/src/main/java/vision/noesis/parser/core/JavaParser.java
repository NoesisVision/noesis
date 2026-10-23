package vision.noesis.parser.core;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import vision.noesis.parser.core.bytecode.BytecodeEngine;
import vision.noesis.parser.core.hybrid.HybridEngine;
import vision.noesis.parser.core.source.SourceEngine;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.Generator;
import vision.noesis.parser.model.Language;
import vision.noesis.parser.model.ManifestArtifact;
import vision.noesis.parser.model.RepositoryInfo;
import vision.noesis.parser.model.ParseManifest;

/** Parses every artifact of a request with the chosen engine into the common code model: one manifest, one model file per artifact. */
public final class JavaParser {

    public static final String GENERATOR_NAME = "noesis-parse-java";

    private final Generator generator;

    public JavaParser(String version) {
        this.generator = new Generator(GENERATOR_NAME, version);
    }

    public Generator generator() {
        return generator;
    }

    public ParseResult parse(ParseRequest request) {
        ParseSession session = new ParseSession(generator, request);
        Engine engine = engineFor(request.engine());
        List<CodeModelFile> models = new ArrayList<>();
        List<Diagnostic> manifestDiagnostics = new ArrayList<>();
        if (request.artifacts().isEmpty()) {
            manifestDiagnostics.add(Diagnostics.error(Diagnostics.MODULE_NOT_PARSED, "No Java module to parse."));
        }
        for (ArtifactInput artifact : request.artifacts()) {
            models.add(engine.parse(artifact, session));
        }
        ParseManifest manifest = manifest(request, models, manifestDiagnostics);
        write(request, manifest, models);
        return new ParseResult(manifest, models, request.outputDirectory());
    }

    public static Engine engineFor(EngineKind kind) {
        return switch (kind) {
            case SOURCE -> new SourceEngine();
            case BYTECODE -> new BytecodeEngine();
            case HYBRID -> new HybridEngine();
        };
    }

    public ParseManifest manifest(ParseRequest request, List<CodeModelFile> models, List<Diagnostic> diagnostics) {
        return new ParseManifest(
                ParseManifest.CURRENT_SCHEMA_VERSION,
                generator,
                Language.JAVA,
                new RepositoryInfo(request.repositoryName(), request.revision()),
                request.root(),
                artifactFiles(models),
                List.copyOf(diagnostics));
    }

    /** One file per model, named after the artifact; a second artifact of the same name gets {@code ~2}. */
    public static List<ManifestArtifact> artifactFiles(List<CodeModelFile> models) {
        Set<String> used = new HashSet<>();
        List<ManifestArtifact> files = new ArrayList<>();
        for (CodeModelFile model : models) {
            String name = model.artifact().name();
            String candidate = name;
            for (int i = 2; !used.add(candidate.toLowerCase(Locale.ROOT)); i++) candidate = name + "~" + i;
            files.add(new ManifestArtifact(model.artifact().id(), CodeModelWriter.artifactFile(Language.JAVA, candidate)));
        }
        return files;
    }

    private static void write(ParseRequest request, ParseManifest manifest, List<CodeModelFile> models) {
        try {
            for (int i = 0; i < models.size(); i++) {
                CodeModelWriter.writeModel(request.outputDirectory(), manifest.artifacts().get(i).file(), models.get(i));
            }
            CodeModelWriter.writeManifest(request.outputDirectory(), manifest);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
