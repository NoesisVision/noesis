package vision.noesis.scanner.maven;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.descriptor.PluginDescriptor;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;
import org.apache.maven.plugins.annotations.ResolutionScope;
import org.apache.maven.project.MavenProject;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.JavaScanner;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.core.java.Locations;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.CodeModelWriter;
import vision.noesis.scanner.model.Generator;
import vision.noesis.scanner.model.Language;
import vision.noesis.scanner.model.RepositoryInfo;
import vision.noesis.scanner.model.ScanManifest;

/**
 * Scans the module into the common code model: one {@code <artifactId>.code-model.json} per module under
 * {@code <out>/code-model/java/} and a manifest listing every module scanned so far, in reactor order. Bound to
 * {@code process-classes} so the module and the siblings it depends on are compiled.
 */
@Mojo(name = "scan", defaultPhase = LifecyclePhase.PROCESS_CLASSES, requiresDependencyResolution = ResolutionScope.COMPILE, threadSafe = true)
public class ScanMojo extends AbstractMojo {

    @Parameter(defaultValue = "${project}", readonly = true, required = true)
    private MavenProject project;

    @Parameter(defaultValue = "${session}", readonly = true, required = true)
    private MavenSession session;

    @Parameter(defaultValue = "${plugin}", readonly = true, required = true)
    private PluginDescriptor plugin;

    /** The output root; files land under {@code code-model/java/} inside it. A relative path is taken from the execution root, not the module. */
    @Parameter(property = "noesis.out", defaultValue = "${session.executionRootDirectory}/.noesis/sessions/scanner")
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
            if (state.start()) clearPreviousScan(outputRoot);
            if (skip) {
                getLog().info("Noesis scan skipped for " + project.getArtifactId());
            } else {
                scanModule(state, outputRoot);
            }
            writeManifest(state, outputRoot);
        } catch (IOException e) {
            throw new MojoExecutionException("Could not write the code model under " + outputRoot, e);
        }
    }

    private void scanModule(ReactorState state, Path outputRoot) throws IOException {
        ArtifactInput input = ProjectInputs.of(project, session, release);
        Engine scanner = JavaScanner.engineFor(EngineKind.of(engine));
        ScanSession scanSession = new ScanSession(generator(), fromExecutionRoot(repositoryRoot), List.of(input), reactorArtifactIds(), reactorOutputDirectories());
        long started = System.nanoTime();
        CodeModelFile model = scanner.scan(input, scanSession);
        String file = state.fileFor(project, JavaIds.artifact(project.getArtifactId()));
        CodeModelWriter.writeModel(outputRoot, file, model);
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
        ScanManifest manifest = new ScanManifest(
                ScanManifest.CURRENT_SCHEMA_VERSION,
                generator(),
                Language.JAVA,
                new RepositoryInfo(name, revision == null ? "" : revision),
                rootFile,
                state.artifacts(),
                state.diagnostics());
        CodeModelWriter.writeManifest(outputRoot, manifest);
    }

    /** Maven resolves a {@code File} parameter against the module; a path given once for the whole reactor belongs to the execution root. */
    private Path fromExecutionRoot(String path) {
        return Path.of(session.getExecutionRootDirectory()).resolve(path).toAbsolutePath().normalize();
    }

    private Generator generator() {
        return new Generator(JavaScanner.GENERATOR_NAME, plugin.getVersion() == null ? "0.0.0" : plugin.getVersion());
    }

    private List<String> reactorArtifactIds() {
        List<String> ids = new ArrayList<>();
        for (MavenProject other : session.getProjects()) {
            if (!"pom".equals(other.getPackaging())) ids.add(other.getArtifactId());
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

    /** The previous scan's files, so a module that disappeared leaves no stale model behind. */
    private static void clearPreviousScan(Path outputRoot) throws IOException {
        Path directory = outputRoot.resolve(CodeModelWriter.languageDirectory(Language.JAVA));
        if (!Files.isDirectory(directory)) return;
        try (Stream<Path> files = Files.walk(directory)) {
            for (Path file : files.sorted(Comparator.reverseOrder()).toList()) Files.delete(file);
        }
    }
}
