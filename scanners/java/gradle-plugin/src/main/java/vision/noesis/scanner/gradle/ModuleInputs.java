package vision.noesis.scanner.gradle;

import java.io.File;
import java.io.Serializable;
import java.nio.charset.Charset;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.gradle.api.tasks.Classpath;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.InputFiles;
import org.gradle.api.tasks.Optional;
import org.gradle.api.tasks.PathSensitive;
import org.gradle.api.tasks.PathSensitivity;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ClasspathEntry;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.PackageReference;

/**
 * What the engines need about one Gradle project, snapshotted off the configured project so the task holds no project at
 * execution time and Gradle can tell when a rerun is due: the sources and the classpath are file inputs, the rest values.
 */
public class ModuleInputs implements Serializable {

    private static final long serialVersionUID = 1L;

    /** One compile classpath element: a sibling project's classes ({@code projectName} set) or a library ({@code packageId} and {@code version} set). */
    public record ClasspathElement(File file, String projectName, String packageId, String version) implements Serializable {

        ArtifactDependency dependency() {
            if (projectName != null) return new ArtifactDependency(JavaIds.artifact(projectName), ArtifactKind.SOURCE, null);
            return new ArtifactDependency(JavaIds.libraryArtifact(packageId, version), ArtifactKind.LIBRARY, new PackageReference(packageId, version));
        }
    }

    private final String projectPath;
    private final String group;
    private final String name;
    private final String version;
    private final File rootDirectory;
    private final File buildFile;
    private final List<File> sourceRoots;
    private final File outputDirectory;
    private final List<ClasspathElement> classpath;
    private final int release;
    private final String encoding;
    private final String packaging;
    private final String mainClass;

    public ModuleInputs(String projectPath, String group, String name, String version, File rootDirectory, File buildFile, List<File> sourceRoots,
                        File outputDirectory, List<ClasspathElement> classpath, int release, String encoding, String packaging, String mainClass) {
        this.projectPath = projectPath;
        this.group = group;
        this.name = name;
        this.version = version;
        this.rootDirectory = rootDirectory;
        this.buildFile = buildFile;
        this.sourceRoots = List.copyOf(sourceRoots);
        this.outputDirectory = outputDirectory;
        this.classpath = List.copyOf(classpath);
        this.release = release;
        this.encoding = encoding;
        this.packaging = packaging;
        this.mainClass = mainClass;
    }

    @Input
    public String getProjectPath() {
        return projectPath;
    }

    @Input
    public String getGroup() {
        return group;
    }

    @Input
    public String getName() {
        return name;
    }

    @Input
    public String getVersion() {
        return version;
    }

    @Input
    public String getRootDirectory() {
        return rootDirectory.getAbsolutePath();
    }

    @Input
    @Optional
    public String getBuildFile() {
        return buildFile == null ? null : buildFile.getAbsolutePath();
    }

    /** Source roots that exist; the model records every declaration in them, so their contents are inputs. */
    @InputFiles
    @PathSensitive(PathSensitivity.RELATIVE)
    public List<File> getSourceRoots() {
        return sourceRoots;
    }

    @Input
    public String getOutputDirectory() {
        return outputDirectory.getAbsolutePath();
    }

    @Classpath
    public List<File> getClasspathFiles() {
        List<File> files = new ArrayList<>(classpath.size());
        for (ClasspathElement element : classpath) files.add(element.file());
        return files;
    }

    /** The artifact each classpath element belongs to, which names the stubs; the files themselves are {@link #getClasspathFiles()}. */
    @Input
    public List<String> getClasspathArtifacts() {
        List<String> artifacts = new ArrayList<>(classpath.size());
        for (ClasspathElement element : classpath) artifacts.add(element.dependency().id().value());
        return artifacts;
    }

    @Input
    public int getRelease() {
        return release;
    }

    @Input
    public String getEncoding() {
        return encoding;
    }

    @Input
    public String getPackaging() {
        return packaging;
    }

    @Input
    @Optional
    public String getMainClass() {
        return mainClass;
    }

    /** The sibling projects on the classpath, by name: they are scanned first. */
    List<String> projectDependencies() {
        List<String> names = new ArrayList<>();
        for (ClasspathElement element : classpath) {
            if (element.projectName() != null && !names.contains(element.projectName())) names.add(element.projectName());
        }
        return names;
    }

    ArtifactInput toArtifactInput(Integer releaseOverride) {
        List<Path> roots = new ArrayList<>(sourceRoots.size());
        for (File root : sourceRoots) roots.add(root.toPath());
        List<ClasspathEntry> entries = new ArrayList<>(classpath.size());
        for (ClasspathElement element : classpath) entries.add(new ClasspathEntry(element.file().toPath(), element.dependency()));
        return new ArtifactInput(group, name, version, rootDirectory.toPath(), buildFile == null ? null : buildFile.toPath(), roots,
                outputDirectory.toPath(), entries, releaseOverride != null ? releaseOverride : release, Charset.forName(encoding), packaging, mainClass);
    }
}
