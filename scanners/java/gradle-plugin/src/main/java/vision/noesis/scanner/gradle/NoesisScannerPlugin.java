package vision.noesis.scanner.gradle;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Properties;
import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.plugins.JavaPlugin;
import org.gradle.api.provider.Provider;
import org.gradle.api.provider.ProviderFactory;
import org.gradle.api.tasks.TaskProvider;
import org.gradle.api.tasks.compile.JavaCompile;

/**
 * Registers one {@code noesisScan} task on the root project that scans every project of the build with the {@code java}
 * plugin, so the model has every module and one manifest whichever project the plugin is applied to. Applying it a
 * second time (in another project, or through {@code allprojects}) adds nothing: the task and the {@code noesis}
 * extension are shared. Every setting is also a Gradle property ({@code -Pnoesis.engine=bytecode}) that wins over the
 * build's {@code noesis { }} block. When {@code noesisScan} is asked for, a compile error fails no compile task, so the
 * scan reads every project with the compiler's errors in its model; any other build compiles as the build says.
 */
public class NoesisScannerPlugin implements Plugin<Project> {

    public static final String TASK_NAME = "noesisScan";
    public static final String EXTENSION_NAME = "noesis";

    private static final String DEFAULT_OUT = ".noesis/tmp/scanner";

    @Override
    public void apply(Project project) {
        Project root = project.getRootProject();
        NoesisExtension extension = root.getExtensions().findByType(NoesisExtension.class);
        if (extension == null) {
            extension = root.getExtensions().create(EXTENSION_NAME, NoesisExtension.class);
            defaults(root, extension);
            register(root, extension);
        }
        if (project != root) project.getExtensions().add(NoesisExtension.class, EXTENSION_NAME, extension);
    }

    private static void defaults(Project root, NoesisExtension extension) {
        extension.getOut().convention(root.getLayout().getProjectDirectory().dir(DEFAULT_OUT));
        extension.getRepositoryRoot().convention(root.getLayout().getProjectDirectory());
        extension.getRepository().convention(extension.getRepositoryRoot().map(directory -> directory.getAsFile().toPath().toAbsolutePath().normalize().getFileName().toString()));
        extension.getRevision().convention("");
        extension.getEngine().convention("source");
    }

    private static void register(Project root, NoesisExtension extension) {
        ProviderFactory providers = root.getProviders();
        TaskProvider<ScanTask> scan = root.getTasks().register(TASK_NAME, ScanTask.class, task -> {
            task.setGroup("verification");
            task.setDescription("Scans the Java projects of the build into the Noesis code model.");
            // A Gradle property wins over the build's noesis { } block, so one command line sets a scan up without touching the build.
            task.getOutputRoot().set(root.getLayout().getProjectDirectory().dir(providers.gradleProperty("noesis.out")).orElse(extension.getOut()));
            task.getRepositoryRoot().set(root.getLayout().getProjectDirectory().dir(providers.gradleProperty("noesis.repositoryRoot")).orElse(extension.getRepositoryRoot()));
            task.getRepositoryName().set(providers.gradleProperty("noesis.repository").orElse(extension.getRepository()));
            task.getRevision().set(providers.gradleProperty("noesis.revision").orElse(extension.getRevision()));
            task.getEngine().set(providers.gradleProperty("noesis.engine").orElse(extension.getEngine()));
            task.getRelease().set(providers.gradleProperty("noesis.release").map(Integer::parseInt).orElse(extension.getRelease()));
            task.getRootFile().set(ProjectInputs.rootFile(root));
            task.getPluginVersion().set(pluginVersion());
        });
        // A build run for a scan compiles past errors: the engines read the sources and the errors land in the model.
        if (scanRequested(root.getGradle().getStartParameter().getTaskNames())) {
            root.allprojects(project -> project.getTasks().withType(JavaCompile.class).configureEach(compile -> compile.getOptions().setFailOnError(false)));
        }
        root.allprojects(project -> project.getPluginManager().withPlugin("java", applied -> {
            Provider<ModuleInputs> inputs = ProjectInputs.of(project);
            scan.configure(task -> {
                task.getModules().add(inputs);
                // The engines read the compiled classes of the module and of the siblings on its classpath.
                task.dependsOn(project.getTasks().named(JavaPlugin.CLASSES_TASK_NAME));
            });
        }));
    }

    /**
     * Whether the command line asks for {@code noesisScan}, by its name or a project path ending in it; an
     * abbreviation ({@code nS}) does not count. Read from the start parameter, so the decision is made while the build
     * is configured and holds under the configuration cache.
     */
    static boolean scanRequested(List<String> taskNames) {
        return taskNames.stream().anyMatch(name -> name.equals(TASK_NAME) || name.endsWith(":" + TASK_NAME));
    }

    /** The version this jar was built as, from the resource the build expands; {@code 0.0.0} when loaded from a classes directory. */
    static String pluginVersion() {
        try (InputStream in = NoesisScannerPlugin.class.getResourceAsStream("plugin.properties")) {
            if (in == null) return "0.0.0";
            Properties properties = new Properties();
            properties.load(in);
            String version = properties.getProperty("version", "").trim();
            return version.isEmpty() || version.startsWith("${") ? "0.0.0" : version;
        } catch (IOException e) {
            return "0.0.0";
        }
    }
}
