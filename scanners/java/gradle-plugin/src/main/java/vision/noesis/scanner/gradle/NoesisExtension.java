package vision.noesis.scanner.gradle;

import org.gradle.api.file.DirectoryProperty;
import org.gradle.api.provider.Property;

/**
 * The {@code noesis { }} block: what the Maven plugin takes as {@code noesis.*} properties. A Gradle property of the same
 * name ({@code -Pnoesis.engine=bytecode}) overrides each setting, so the service can drive a scan without touching the
 * build.
 */
public abstract class NoesisExtension {

    /** The output root; files land under {@code code-model/java/} inside it. Default: {@code .noesis/tmp/scanner} in the root project. */
    public abstract DirectoryProperty getOut();

    /** The directory file paths in the model are relative to. Default: the root project's directory. */
    public abstract DirectoryProperty getRepositoryRoot();

    /** The repository name written into the manifest. Default: the repository root's directory name. */
    public abstract Property<String> getRepository();

    public abstract Property<String> getRevision();

    /** {@code source} (javac over the sources), {@code bytecode} (ArchUnit over the compiled classes) or {@code hybrid} (the source model plus what only the classes hold). */
    public abstract Property<String> getEngine();

    /** The Java release the sources are written for; the compile task's {@code release}, else {@code targetCompatibility}, when not set. */
    public abstract Property<Integer> getRelease();
}
