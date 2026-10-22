package vision.noesis.scanner.gradle;

import java.io.File;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.gradle.api.JavaVersion;
import org.gradle.api.Project;
import org.gradle.api.artifacts.component.ComponentIdentifier;
import org.gradle.api.artifacts.component.ModuleComponentIdentifier;
import org.gradle.api.artifacts.component.ProjectComponentIdentifier;
import org.gradle.api.artifacts.result.ResolvedArtifactResult;
import org.gradle.api.plugins.JavaApplication;
import org.gradle.api.plugins.JavaPlugin;
import org.gradle.api.plugins.JavaPluginExtension;
import org.gradle.api.provider.Provider;
import org.gradle.api.tasks.SourceSet;
import org.gradle.api.tasks.compile.JavaCompile;
import org.gradle.jvm.tasks.Jar;
import vision.noesis.scanner.gradle.ModuleInputs.ClasspathElement;

/** What the engines need about a Gradle project, read off the configured project; the Gradle counterpart of the Maven plugin's class of the same name. */
final class ProjectInputs {

    /** A dependency on a file rather than a module has no coordinates; its artifact is named after the file. */
    private static final String FILE_DEPENDENCY_VERSION = "local";

    private ProjectInputs() {}

    /** Lazy, so the project is read after it is configured and its compile classpath resolved only when the scan runs. */
    static Provider<ModuleInputs> of(Project project) {
        Provider<Set<ResolvedArtifactResult>> artifacts = project.getConfigurations()
                .getByName(JavaPlugin.COMPILE_CLASSPATH_CONFIGURATION_NAME)
                .getIncoming()
                .getArtifacts()
                .getResolvedArtifacts();
        return artifacts.map(resolved -> read(project, resolved));
    }

    private static ModuleInputs read(Project project, Set<ResolvedArtifactResult> resolved) {
        JavaPluginExtension java = project.getExtensions().getByType(JavaPluginExtension.class);
        SourceSet main = java.getSourceSets().getByName(SourceSet.MAIN_SOURCE_SET_NAME);
        JavaCompile compile = project.getTasks().named(main.getCompileJavaTaskName(), JavaCompile.class).get();
        List<File> sourceRoots = new ArrayList<>();
        for (File root : main.getJava().getSrcDirs()) {
            if (root.isDirectory()) sourceRoots.add(root);
        }
        File generated = compile.getOptions().getGeneratedSourceOutputDirectory().getAsFile().getOrNull();
        if (generated != null && generated.isDirectory() && !sourceRoots.contains(generated)) sourceRoots.add(generated);
        List<ClasspathElement> classpath = new ArrayList<>();
        for (ResolvedArtifactResult artifact : resolved) classpath.add(elementOf(artifact));
        classpath.sort((a, b) -> a.file().getPath().compareTo(b.file().getPath()));
        String version = project.getVersion().toString();
        return new ModuleInputs(
                project.getPath(),
                project.getGroup().toString(),
                project.getName(),
                Project.DEFAULT_VERSION.equals(version) ? "" : version,
                project.getProjectDir(),
                project.getBuildFile().isFile() ? project.getBuildFile() : null,
                sourceRoots,
                main.getJava().getClassesDirectory().get().getAsFile(),
                classpath,
                releaseOf(java, compile),
                encodingOf(compile),
                project.getPluginManager().hasPlugin("war") ? "war" : "jar",
                mainClassOf(project));
    }

    /** A project of this build is a source artifact; a module is a library named by its coordinates; a plain file is a library named after itself. */
    private static ClasspathElement elementOf(ResolvedArtifactResult artifact) {
        File file = artifact.getFile();
        ComponentIdentifier component = artifact.getId().getComponentIdentifier();
        if (component instanceof ProjectComponentIdentifier project && ":".equals(project.getBuild().getBuildPath())) {
            return new ClasspathElement(file, project.getProjectPath(), project.getProjectName(), null, null);
        }
        if (component instanceof ModuleComponentIdentifier module) {
            String classifier = classifierOf(file.getName(), module.getModule(), module.getVersion());
            String packageId = module.getGroup() + ":" + module.getModule() + (classifier == null ? "" : ":" + classifier);
            return new ClasspathElement(file, null, null, packageId, module.getVersion());
        }
        String name = file.getName();
        int dot = name.lastIndexOf('.');
        return new ClasspathElement(file, null, null, dot > 0 ? name.substring(0, dot) : name, FILE_DEPENDENCY_VERSION);
    }

    /** Gradle does not expose the classifier of a resolved artifact; {@code <module>-<version>-<classifier>.jar} is the Maven layout it came in. */
    private static String classifierOf(String fileName, String module, String version) {
        String prefix = module + "-" + version + "-";
        int dot = fileName.lastIndexOf('.');
        if (!fileName.startsWith(prefix) || dot <= prefix.length()) return null;
        return fileName.substring(prefix.length(), dot);
    }

    /** The compile task's {@code release}, else {@code targetCompatibility}, which is the toolchain's version or the running JVM's when not set. */
    private static int releaseOf(JavaPluginExtension java, JavaCompile compile) {
        Integer release = compile.getOptions().getRelease().getOrNull();
        if (release != null) return release;
        JavaVersion target = java.getTargetCompatibility();
        return target == null ? Runtime.version().feature() : Integer.parseInt(target.getMajorVersion());
    }

    private static String encodingOf(JavaCompile compile) {
        String encoding = compile.getOptions().getEncoding();
        if (encoding == null || encoding.isBlank()) return StandardCharsets.UTF_8.name();
        try {
            return Charset.forName(encoding.trim()).name();
        } catch (IllegalArgumentException e) {
            return StandardCharsets.UTF_8.name();
        }
    }

    /** The {@code application} plugin's main class, else Spring Boot's, else the jar manifest's {@code Main-Class}; null when none is configured. */
    private static String mainClassOf(Project project) {
        JavaApplication application = project.getExtensions().findByType(JavaApplication.class);
        if (application != null && application.getMainClass().isPresent()) return blankToNull(application.getMainClass().get());
        String springBoot = springBootMainClass(project.getExtensions().findByName("springBoot"));
        if (springBoot != null) return springBoot;
        Jar jar = (Jar) project.getTasks().findByName(JavaPlugin.JAR_TASK_NAME);
        if (jar == null) return null;
        Object attribute = jar.getManifest().getAttributes().get("Main-Class");
        if (attribute instanceof Provider<?> provider) attribute = provider.getOrNull();
        return attribute == null ? null : blankToNull(attribute.toString());
    }

    /** {@code springBoot.mainClass} through reflection: the plugin is not a dependency of this one. */
    private static String springBootMainClass(Object extension) {
        if (extension == null) return null;
        try {
            Method getter = extension.getClass().getMethod("getMainClass");
            Object value = getter.invoke(extension);
            if (value instanceof Provider<?> provider) value = provider.getOrNull();
            return value == null ? null : blankToNull(value.toString());
        } catch (ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }

    /** The build's entry file, as the manifest reports what was scanned: the settings file, else the root build file, else none. */
    static String rootFile(Project root) {
        for (String candidate : List.of("settings.gradle", "settings.gradle.kts")) {
            File settings = new File(root.getProjectDir(), candidate);
            if (settings.isFile()) return settings.getAbsolutePath();
        }
        return root.getBuildFile().isFile() ? root.getBuildFile().getAbsolutePath() : "";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
