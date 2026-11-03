package vision.noesis.parser.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.ArtifactNodes;
import vision.noesis.parser.core.ClasspathEntry;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.Engine;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.ModelBuilder;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.core.java.ReleaseClassFiles;
import vision.noesis.parser.model.ArtifactNode;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.NodeId;

/**
 * The ArchUnit engine: imports the module's compiled classes, resolves what they reference from the compile classpath
 * and the JDK, and reads the class files once more for what ArchUnit does not expose. Its model has the gaps bytecode
 * has: line-only locations, no Javadoc, parameter names only with {@code -parameters}, no casts or array creations.
 */
public final class BytecodeEngine implements Engine {

    @Override
    public CodeModelFile parse(ArtifactInput input, ParseSession session) {
        ModelBuilder builder = new ModelBuilder();
        NodeId artifactId = input.id();
        ArtifactNode artifact = ArtifactNodes.of(input, session, artifactId, EngineKind.BYTECODE);
        List<Path> classDirectories = compiled(input);
        if (classDirectories.isEmpty()) {
            builder.diagnostic(Diagnostics.error(Diagnostics.CLASSES_MISSING, "No compiled classes at " + input.outputDirectory() + "; build the module first."));
            return builder.build(session.generator(), artifact, session);
        }
        try (ReleaseClassFiles release = ReleaseClassFiles.open(input.release()).orElse(null);
                ParseClassLoader loader = classpathLoader(input, release)) {
            if (release == null && input.release() != Runtime.version().feature()) {
                builder.diagnostic(Diagnostics.info(Diagnostics.PLATFORM_FROM_RUNTIME, "The running JDK has no API signatures for release " + input.release() + "; JDK classes are those of JDK " + Runtime.version().feature() + ".", null));
            }
            ClassFileDetails details = ClassFileDetails.read(classDirectories);
            JavaClasses classes = importWithClasspath(classDirectories, loader);
            BytecodeContext context = new BytecodeContext(input, session, builder, details, artifactId, loader, release);
            new BytecodeDeclarations(context).walk(classes);
            new BytecodeAccesses(context).walk(classes);
            BytecodeClosure.collect(context);
            if (details.parameterNamesMissing()) {
                builder.diagnostic(Diagnostics.info(Diagnostics.NO_PARAMETER_NAMES, "Parameter names are not in the class files; compile with -parameters to keep them.", null));
            }
        } catch (IOException | RuntimeException | StackOverflowError e) {
            return Diagnostics.notParsed(input, artifact, session, Diagnostics.describe(e));
        }
        return builder.build(session.generator(), artifact, session);
    }

    /** The release's JDK and the compile classpath; the running JDK's classes only when the release's are unavailable. */
    private static ParseClassLoader classpathLoader(ArtifactInput input, ReleaseClassFiles release) throws MalformedURLException {
        List<URL> urls = new ArrayList<>();
        for (ClasspathEntry entry : input.classpath()) urls.add(toUrl(entry));
        return new ParseClassLoader(urls.toArray(new URL[0]), release);
    }

    /**
     * The module's class directories that exist. Test classes are missing when the build did not compile them (a parse
     * bound before {@code process-test-classes}, {@code -Dmaven.test.skip}); the classes there are still the module's.
     */
    private static List<Path> compiled(ArtifactInput input) {
        List<Path> directories = new ArrayList<>();
        for (Path directory : input.classDirectories()) {
            if (Files.isDirectory(directory)) directories.add(directory);
        }
        return directories;
    }

    /** ArchUnit resolves referenced classes through the context class loader; the compile classpath is put there for the import. */
    private static JavaClasses importWithClasspath(List<Path> classDirectories, ParseClassLoader loader) {
        Thread thread = Thread.currentThread();
        ClassLoader previous = thread.getContextClassLoader();
        try {
            thread.setContextClassLoader(loader);
            List<Path> versions = classDirectories.stream().map(directory -> ClassFileDetails.versionsDirectory(directory.toAbsolutePath().normalize())).toList();
            return new ClassFileImporter()
                    .withImportOption(location -> !"file".equals(location.asURI().getScheme()) || versions.stream().noneMatch(Path.of(location.asURI()).normalize()::startsWith))
                    .importPaths(classDirectories);
        } finally {
            thread.setContextClassLoader(previous);
        }
    }

    private static URL toUrl(ClasspathEntry entry) throws MalformedURLException {
        return entry.path().toUri().toURL();
    }
}
