package vision.noesis.scanner.gradle;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.gradle.api.DefaultTask;
import org.gradle.api.file.Directory;
import org.gradle.api.file.DirectoryProperty;
import org.gradle.api.provider.ListProperty;
import org.gradle.api.provider.Property;
import org.gradle.api.provider.Provider;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.Internal;
import org.gradle.api.tasks.Nested;
import org.gradle.api.tasks.Optional;
import org.gradle.api.tasks.OutputDirectory;
import org.gradle.api.tasks.TaskAction;
import org.gradle.work.DisableCachingByDefault;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.JavaScanner;
import vision.noesis.scanner.core.ScanRequest;
import vision.noesis.scanner.core.ScanResult;
import vision.noesis.scanner.core.java.Locations;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.CodeModelWriter;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.DiagnosticSeverity;
import vision.noesis.scanner.model.Language;

/**
 * Scans every Java project of the build into the common code model in one go: one {@code <name>.code-model.json} per
 * project under {@code <out>/code-model/java/}, in dependency order, and the manifest listing them. The previous scan's
 * files are removed first, so a project that disappeared leaves no stale model behind.
 */
@DisableCachingByDefault(because = "The model holds absolute paths of the repository root and the classpath; a cache hit from another checkout would be wrong")
public abstract class ScanTask extends DefaultTask {

    @Nested
    public abstract ListProperty<ModuleInputs> getModules();

    /** The output root; the model directory inside it is the task's output. */
    @Internal
    public abstract DirectoryProperty getOutputRoot();

    @OutputDirectory
    public Provider<Directory> getModelDirectory() {
        return getOutputRoot().dir(CodeModelWriter.languageDirectory(Language.JAVA));
    }

    @Internal
    public abstract DirectoryProperty getRepositoryRoot();

    /** The repository root as a value: moving it changes every path in the model. */
    @Input
    public Provider<String> getRepositoryRootPath() {
        return getRepositoryRoot().map(directory -> directory.getAsFile().getAbsolutePath());
    }

    @Input
    public abstract Property<String> getRepositoryName();

    @Input
    public abstract Property<String> getRevision();

    @Input
    public abstract Property<String> getEngine();

    @Input
    @Optional
    public abstract Property<Integer> getRelease();

    /** Absolute path of the build's entry file; empty when the build has none. */
    @Input
    public abstract Property<String> getRootFile();

    @Input
    public abstract Property<String> getPluginVersion();

    @TaskAction
    public void scan() {
        Path repositoryRoot = getRepositoryRoot().get().getAsFile().toPath().toAbsolutePath().normalize();
        Path outputRoot = getOutputRoot().get().getAsFile().toPath().toAbsolutePath().normalize();
        EngineKind engine = EngineKind.of(getEngine().get());
        Integer release = getRelease().getOrNull();
        List<ArtifactInput> artifacts = new ArrayList<>();
        for (ModuleInputs module : inDependencyOrder(getModules().get())) artifacts.add(module.toArtifactInput(release));
        String rootFile = getRootFile().get();
        ScanRequest request = new ScanRequest(
                repositoryRoot,
                getRepositoryName().get(),
                getRevision().get(),
                rootFile.isEmpty() ? "" : new Locations(repositoryRoot).relativePath(Path.of(rootFile)),
                outputRoot,
                engine,
                artifacts);
        clearPreviousScan(outputRoot);
        long started = System.nanoTime();
        ScanResult result = new JavaScanner(getPluginVersion().get()).scan(request);
        for (CodeModelFile model : result.models()) {
            getLogger().lifecycle(String.format("%s: %d nodes, %d edges, %d stubs, %d diagnostics (%s engine)",
                    model.artifact().name(), model.nodes().size(), model.edges().size(), model.stubs().size(), model.diagnostics().size(), engine.id()));
        }
        for (Diagnostic diagnostic : result.manifest().diagnostics()) {
            if (diagnostic.severity() == DiagnosticSeverity.ERROR) getLogger().error("{}: {}", diagnostic.code(), diagnostic.message());
            else getLogger().warn("{}: {}", diagnostic.code(), diagnostic.message());
        }
        getLogger().lifecycle(String.format("Noesis code model of %d project(s) written to %s in %d ms",
                result.models().size(), outputRoot.resolve(CodeModelWriter.manifestFile(Language.JAVA)), (System.nanoTime() - started) / 1_000_000));
    }

    /** Projects before the projects that depend on them, in project path order otherwise; what Maven's reactor order gives the Maven plugin. */
    static List<ModuleInputs> inDependencyOrder(List<ModuleInputs> modules) {
        Map<String, ModuleInputs> byName = new LinkedHashMap<>();
        List<ModuleInputs> sorted = new ArrayList<>(modules);
        sorted.sort(Comparator.comparing(ModuleInputs::getProjectPath));
        for (ModuleInputs module : sorted) byName.putIfAbsent(module.getName(), module);
        List<ModuleInputs> order = new ArrayList<>();
        Set<ModuleInputs> visited = new HashSet<>();
        for (ModuleInputs module : sorted) visit(module, byName, visited, new HashSet<>(), order);
        return order;
    }

    private static void visit(ModuleInputs module, Map<String, ModuleInputs> byName, Set<ModuleInputs> visited, Set<ModuleInputs> onPath, List<ModuleInputs> order) {
        if (!visited.add(module)) return;
        onPath.add(module);
        for (String dependency : module.projectDependencies()) {
            ModuleInputs other = byName.get(dependency);
            // A dependency outside the scanned projects, or a cycle Gradle would have rejected anyway: nothing to order.
            if (other != null && !onPath.contains(other)) visit(other, byName, visited, onPath, order);
        }
        onPath.remove(module);
        order.add(module);
    }

    private static void clearPreviousScan(Path outputRoot) {
        Path directory = outputRoot.resolve(CodeModelWriter.languageDirectory(Language.JAVA));
        if (!Files.isDirectory(directory)) return;
        try (Stream<Path> files = Files.walk(directory)) {
            for (Path file : files.sorted(Comparator.reverseOrder()).toList()) {
                if (!file.equals(directory)) Files.delete(file);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Could not clear the previous scan under " + directory, e);
        }
    }
}
