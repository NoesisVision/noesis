package vision.noesis.parser.gradle;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.JavaParser;
import vision.noesis.parser.core.ParseRequest;
import vision.noesis.parser.core.ParseResult;
import vision.noesis.parser.core.java.Locations;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.CodeModelWriter;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.Language;

/**
 * Parses every Java project of the build into the common code model in one go: one {@code <name>.code-model.json} per
 * project under {@code <out>/code-model/java/}, in dependency order, and the manifest listing them.
 */
@DisableCachingByDefault(because = "The model holds absolute paths of the repository root and the classpath; a cache hit from another checkout would be wrong")
public abstract class ParseTask extends DefaultTask {

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
    public void parse() {
        Path repositoryRoot = getRepositoryRoot().get().getAsFile().toPath().toAbsolutePath().normalize();
        Path outputRoot = getOutputRoot().get().getAsFile().toPath().toAbsolutePath().normalize();
        EngineKind engine = EngineKind.of(getEngine().get());
        Integer release = getRelease().getOrNull();
        List<ModuleInputs> modules = inDependencyOrder(getModules().get());
        Map<String, String> uniqueNames = ModuleInputs.uniqueNames(modules);
        List<ArtifactInput> artifacts = new ArrayList<>();
        for (ModuleInputs module : modules) artifacts.add(module.toArtifactInput(release, uniqueNames));
        String rootFile = getRootFile().get();
        ParseRequest request = new ParseRequest(
                repositoryRoot,
                getRepositoryName().get(),
                getRevision().get(),
                rootFile.isEmpty() ? "" : new Locations(repositoryRoot).relativePath(Path.of(rootFile)),
                outputRoot,
                engine,
                artifacts);
        long started = System.nanoTime();
        ParseResult result = new JavaParser(getPluginVersion().get()).parse(request);
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
        Map<String, ModuleInputs> byPath = new LinkedHashMap<>();
        List<ModuleInputs> sorted = new ArrayList<>(modules);
        sorted.sort(Comparator.comparing(ModuleInputs::getProjectPath));
        for (ModuleInputs module : sorted) byPath.putIfAbsent(module.getProjectPath(), module);
        List<ModuleInputs> order = new ArrayList<>();
        Set<ModuleInputs> visited = new HashSet<>();
        for (ModuleInputs module : sorted) visit(module, byPath, visited, new HashSet<>(), order);
        return order;
    }

    private static void visit(ModuleInputs module, Map<String, ModuleInputs> byPath, Set<ModuleInputs> visited, Set<ModuleInputs> onPath, List<ModuleInputs> order) {
        if (!visited.add(module)) return;
        onPath.add(module);
        for (String dependency : module.projectDependencies()) {
            ModuleInputs other = byPath.get(dependency);
            // A dependency outside the parsed projects, or a cycle Gradle would have rejected anyway: nothing to order.
            if (other != null && !onPath.contains(other)) visit(other, byPath, visited, onPath, order);
        }
        onPath.remove(module);
        order.add(module);
    }
}
