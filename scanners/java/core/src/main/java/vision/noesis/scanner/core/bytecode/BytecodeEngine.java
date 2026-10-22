package vision.noesis.scanner.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ArtifactNodes;
import vision.noesis.scanner.core.ClasspathEntry;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.core.java.ReleaseClassFiles;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.NodeId;

/**
 * The ArchUnit engine: imports the module's compiled classes, resolves what they reference from the compile classpath
 * and the JDK, and reads the class files once more for what ArchUnit does not expose. Its model has the gaps bytecode
 * has: line-only locations, no Javadoc, parameter names only with {@code -parameters}, no casts or array creations.
 */
public final class BytecodeEngine implements Engine {

    @Override
    public CodeModelFile scan(ArtifactInput input, ScanSession session) {
        ModelBuilder builder = new ModelBuilder();
        NodeId artifactId = JavaIds.artifact(input.artifactId());
        ArtifactNode artifact = ArtifactNodes.of(input, session, artifactId, EngineKind.BYTECODE);
        if (!Files.isDirectory(input.outputDirectory())) {
            builder.diagnostic(Diagnostics.error(Diagnostics.CLASSES_MISSING, "No compiled classes at " + input.outputDirectory() + "; build the module first."));
            return builder.build(session.generator(), artifact, session);
        }
        try (ReleaseClassFiles release = ReleaseClassFiles.open(input.release()).orElse(null);
                ScanClassLoader loader = classpathLoader(input, release)) {
            if (release == null && input.release() != Runtime.version().feature()) {
                builder.diagnostic(Diagnostics.info(Diagnostics.PLATFORM_FROM_RUNTIME, "The running JDK has no API signatures for release " + input.release() + "; JDK classes are those of JDK " + Runtime.version().feature() + ".", null));
            }
            ClassFileDetails details = ClassFileDetails.read(input.outputDirectory());
            JavaClasses classes = importWithClasspath(input, loader);
            BytecodeContext context = new BytecodeContext(input, session, builder, details, artifactId, loader, release);
            new BytecodeDeclarations(context).walk(classes);
            new BytecodeAccesses(context).walk(classes);
            BytecodeClosure.collect(context);
            if (details.parameterNamesMissing()) {
                builder.diagnostic(Diagnostics.info(Diagnostics.NO_PARAMETER_NAMES, "Parameter names are not in the class files; compile with -parameters to keep them.", null));
            }
        } catch (IOException | RuntimeException e) {
            builder.diagnostic(Diagnostics.error(Diagnostics.MODULE_NOT_SCANNED, "Module " + input.artifactId() + " could not be scanned: " + e));
        }
        return builder.build(session.generator(), artifact, session);
    }

    /** The release's JDK and the compile classpath; the running JDK's classes only when the release's are unavailable. */
    private static ScanClassLoader classpathLoader(ArtifactInput input, ReleaseClassFiles release) throws MalformedURLException {
        List<URL> urls = new ArrayList<>();
        for (ClasspathEntry entry : input.classpath()) urls.add(toUrl(entry));
        return new ScanClassLoader(urls.toArray(new URL[0]), release);
    }

    /** ArchUnit resolves referenced classes through the context class loader; the compile classpath is put there for the import. */
    private static JavaClasses importWithClasspath(ArtifactInput input, ScanClassLoader loader) {
        Thread thread = Thread.currentThread();
        ClassLoader previous = thread.getContextClassLoader();
        try {
            thread.setContextClassLoader(loader);
            return new ClassFileImporter().importPath(input.outputDirectory());
        } finally {
            thread.setContextClassLoader(previous);
        }
    }

    private static URL toUrl(ClasspathEntry entry) throws MalformedURLException {
        return entry.path().toUri().toURL();
    }
}
