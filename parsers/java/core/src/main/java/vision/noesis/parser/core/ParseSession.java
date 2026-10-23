package vision.noesis.parser.core;

import java.nio.file.Path;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import vision.noesis.parser.core.java.ClasspathIndex;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.core.java.Locations;
import vision.noesis.parser.model.Generator;
import vision.noesis.parser.model.NodeId;

/** What every artifact of one parse shares: the generator, the repository, which artifacts are parsed, the classpath index. */
public final class ParseSession {

    private final Generator generator;
    private final Locations locations;
    private final ClasspathIndex classpath;
    private final Set<NodeId> sourceArtifacts;
    private final Set<Path> parsedOutputDirectories;

    public ParseSession(Generator generator, ParseRequest request) {
        this(generator, request.repositoryRoot(), request.artifacts(),
                request.artifacts().stream().map(ArtifactInput::uniqueName).collect(Collectors.toList()),
                request.artifacts().stream().map(ArtifactInput::outputDirectory).collect(Collectors.toList()));
    }

    /**
     * @param inputs            the artifacts whose classpaths are known here; the index also covers their output directories
     * @param sourceArtifactIds every artifact of the build, parsed in this process or another
     * @param outputDirectories the class directories of every artifact of the build
     */
    public ParseSession(Generator generator, Path repositoryRoot, List<ArtifactInput> inputs, Collection<String> sourceArtifactIds, Collection<Path> outputDirectories) {
        this.generator = generator;
        this.locations = new Locations(repositoryRoot);
        this.classpath = ClasspathIndex.of(inputs, sourceArtifactIds, outputDirectories);
        this.sourceArtifacts = sourceArtifactIds.stream().map(JavaIds::artifact).collect(Collectors.toUnmodifiableSet());
        this.parsedOutputDirectories = outputDirectories.stream().map(path -> path.toAbsolutePath().normalize()).collect(Collectors.toUnmodifiableSet());
    }

    public Generator generator() {
        return generator;
    }

    public Locations locations() {
        return locations;
    }

    public ClasspathIndex classpath() {
        return classpath;
    }

    /** The parsed module itself or another module of the build: its symbols have a model file of their own. */
    public boolean isSourceArtifact(NodeId artifact) {
        return sourceArtifacts.contains(artifact);
    }

    public boolean isParsedOutputDirectory(Path directory) {
        return parsedOutputDirectories.contains(directory.toAbsolutePath().normalize());
    }
}
