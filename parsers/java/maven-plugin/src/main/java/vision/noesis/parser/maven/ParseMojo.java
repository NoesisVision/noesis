package vision.noesis.parser.maven;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.descriptor.PluginDescriptor;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.plugins.annotations.ResolutionScope;
import org.apache.maven.project.MavenProject;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.Engine;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.JavaParser;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.core.java.Locations;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.Generator;
import vision.noesis.parser.model.Language;
import vision.noesis.parser.model.ManifestArtifact;
import vision.noesis.parser.model.RepositoryInfo;
import vision.noesis.parser.model.ParseManifest;

/**
 * Parses the module into the common code model: one {@code <artifactId>.code-model.json} per module under
 * {@code <out>/code-model/java/} and a manifest listing every module parsed so far, in reactor order. Bound to
 * {@code process-classes} so the module and the siblings it depends on are compiled.
 */
@Mojo(name = "parse", defaultPhase = LifecyclePhase.PROCESS_CLASSES, requiresDependencyResolution = ResolutionScope.COMPILE, threadSafe = true)
public class ParseMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project}", readonly = true, required = true)
    private MavenProject project;

    @Parameter(defaultValue = "${session}", readonly = true, required = true)
    private MavenSession session;

    @Parameter(defaultValue = "${plugin}", readonly = true, required = true)
    private PluginDescriptor plugin;

    /** The output root; files land under {@code code-model/java/} inside it. A relative path is taken from the execution root, not the module. */
    @Parameter(property = "noesis.out", defaultValue = "${session.executionRootDirectory}/.noesis/tmp/parser")
    private String out;

    /** The directory file paths in the model are relative to; a relative path is taken from the execution root. */
    @Parameter(property = "noesis.repositoryRoot", defaultValue = "${session.executionRootDirectory}")
    private String repositoryRoot;

    /** The repository name written into the manifest; the root directory's name when not given. */
    @Parameter(property = "noesis.repository")
    private String repository;

    @Parameter(property = "noesis.revision", defaultValue = "")
    private String revision;

    /** {@code source} (javac over the sources), {@code bytecode} (ArchUnit over the compiled classes) or {@code hybrid} (the source model plus what only the classes hold). */
    @Parameter(property = "noesis.engine", defaultValue = "source")
    private String engine;

    /** The Java release the sources are written for; {@code maven.compiler.release} or {@code maven.compiler.target} when not given. */
    @Parameter(property = "noesis.release")
    private Integer release;

    @Parameter(property = "noesis.skip", defaultValue = "false")
    private boolean skip;

    @Override
    public void execute() throws MojoExecutionException {
        if ("pom".equals(project.getPackaging())) return;
        ReactorState state = ReactorState.of(session, plugin);
        Path outputRoot = fromExecutionRoot(out);
        try {
            if (skip) {
                getLog().info("Noesis parse skipped for " + project.getArtifactId());
            } else {
                parseModule(state, outputRoot);
            }
            writeManifest(state, outputRoot);
        } catch (IOException e) {
            throw new MojoExecutionException("Could not write the code model under " + outputRoot, e);
        }
    }

    private void parseModule(ReactorState state, Path outputRoot) throws IOException {
        ArtifactInput input = ProjectInputs.of(project, session, release);
        Engine parser = JavaParser.engineFor(EngineKind.of(engine));
        ParseSession parseSession = new ParseSession(generator(), fromExecutionRoot(repositoryRoot), List.of(input), reactorArtifactIds(), reactorOutputDirectories());
        long started = System.nanoTime();
        CodeModelFile model = parser.parse(input, parseSession);
        String file = state.fileFor(project);
        CodeModelWriter.writeModel(outputRoot, file, model);
        state.written(project, new ManifestArtifact(input.id(), file));
        getLog().info(String.format("%s: %d nodes, %d edges, %d stubs, %d diagnostics in %d ms (%s engine)",
                project.getArtifactId(), model.nodes().size(), model.edges().size(), model.stubs().size(), model.diagnostics().size(),
                (System.nanoTime() - started) / 1_000_000, engine));
    }

    private void writeManifest(ReactorState state, Path outputRoot) throws IOException {
        Path root = fromExecutionRoot(repositoryRoot);
        Locations locations = new Locations(root);
        File topLevel = session.getTopLevelProject().getFile();
        String rootFile = topLevel == null ? "" : locations.relativePath(topLevel.toPath());
        String name = repository == null || repository.isBlank() ? root.getFileName().toString() : repository;
        RepositoryInfo repositoryInfo = new RepositoryInfo(name, revision == null ? "" : revision);
        state.writeManifest(outputRoot, (artifacts, diagnostics) -> new ParseManifest(
                ParseManifest.CURRENT_SCHEMA_VERSION,
                generator(),
                Language.JAVA,
                repositoryInfo,
                rootFile,
                artifacts,
                diagnostics));
    }

    /** Maven resolves a {@code File} parameter against the module; a path given once for the whole reactor belongs to the execution root. */
    private Path fromExecutionRoot(String path) {
        return Path.of(session.getExecutionRootDirectory()).resolve(path).toAbsolutePath().normalize();
    }

    private Generator generator() {
        return new Generator(JavaParser.GENERATOR_NAME, plugin.getVersion() == null ? "0.0.0" : plugin.getVersion());
    }

    /** The names of the reactor's modules in their artifact ids, as {@link ProjectInputs} names this module and its siblings. */
    private List<String> reactorArtifactIds() {
        List<String> names = ProjectInputs.moduleNames(session);
        List<String> ids = new ArrayList<>();
        for (MavenProject other : session.getProjects()) {
            if (!"pom".equals(other.getPackaging())) ids.add(ProjectInputs.uniqueName(other.getGroupId(), other.getArtifactId(), names));
        }
        return ids;
    }

    private List<Path> reactorOutputDirectories() {
        List<Path> directories = new ArrayList<>();
        for (MavenProject other : session.getProjects()) {
            if (!"pom".equals(other.getPackaging())) directories.add(Path.of(other.getBuild().getOutputDirectory()));
        }
        return directories;
    }
}
