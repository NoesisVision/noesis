package vision.noesis.scanner.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.Source;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.java.ReleaseClassFiles;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.SourceSpan;

/** Everything the bytecode engine's mappers of one artifact share. */
final class BytecodeContext {

    final ArtifactInput input;
    final ScanSession session;
    final ModelBuilder builder;
    final ClassFileDetails details;
    final BytecodeIds ids;
    final BytecodeTypeRefs types;
    final BytecodeAnnotations annotations;
    final NodeId artifactId;
    final ClassLoader classpathLoader;
    /** The JDK of the module's release, or null when the running JDK stands in. */
    final ReleaseClassFiles release;

    private final Map<String, Optional<ArtifactDependency>> dependencyByClass = new HashMap<>();
    private final Map<String, String> sourceFiles = new HashMap<>();
    private final Map<String, JavaClass> resolved = new HashMap<>();

    BytecodeContext(ArtifactInput input, ScanSession session, ModelBuilder builder, ClassFileDetails details, NodeId artifactId, ClassLoader classpathLoader, ReleaseClassFiles release) {
        this.input = input;
        this.session = session;
        this.builder = builder;
        this.details = details;
        this.artifactId = artifactId;
        this.classpathLoader = classpathLoader;
        this.release = release;
        this.ids = new BytecodeIds(this);
        this.types = new BytecodeTypeRefs(this);
        this.annotations = new BytecodeAnnotations(this);
    }

    /** Read from this module's class directory. */
    boolean isScanned(JavaClass type) {
        Optional<Source> source = topLevel(type).getSource();
        if (source.isEmpty() || !"file".equals(source.get().getUri().getScheme())) return false;
        Path file = Path.of(source.get().getUri()).toAbsolutePath().normalize();
        return file.startsWith(input.outputDirectory().toAbsolutePath().normalize());
    }

    /** Neither this module nor a sibling of the build: referenced through a stub. */
    boolean isStubbed(JavaClass type) {
        if (isScanned(type)) return false;
        return dependencyOf(type).map(dependency -> dependency.kind() != ArtifactKind.SOURCE).orElse(true);
    }

    Optional<ArtifactDependency> dependencyOf(JavaClass type) {
        JavaClass top = topLevel(type);
        return dependencyByClass.computeIfAbsent(top.getName(), name -> locate(top));
    }

    NodeId artifactOf(JavaClass type) {
        return dependencyOf(type).map(ArtifactDependency::id).orElse(null);
    }

    private Optional<ArtifactDependency> locate(JavaClass top) {
        Optional<Source> source = top.getSource();
        if (source.isEmpty()) return Optional.empty();
        URI uri = source.get().getUri();
        if (release != null) {
            Optional<String> module = release.moduleOf(uri);
            if (module.isPresent()) return Optional.of(session.classpath().platform(module.get(), input.release()));
        }
        if ("jrt".equals(uri.getScheme())) {
            String path = uri.getPath() == null ? "" : uri.getPath();
            int start = path.startsWith("/") ? 1 : 0;
            int end = path.indexOf('/', start);
            String module = end < 0 ? path.substring(start) : path.substring(start, end);
            return Optional.of(session.classpath().platform(module, input.release()));
        }
        return session.classpath().dependencyOf(uri);
    }

    /**
     * ArchUnit imports the classes an imported class references, but not what those reference in turn; a class it
     * only knows by name is imported from the classpath on demand, so its kind and supertypes are known.
     */
    JavaClass fullyImported(JavaClass type) {
        if (type.isFullyImported() || type.isPrimitive() || type.isArray()) return type;
        return resolved.computeIfAbsent(type.getName(), name -> {
            java.net.URL resource = classpathLoader.getResource(name.replace('.', '/') + ".class");
            if (resource == null) return type;
            Thread thread = Thread.currentThread();
            ClassLoader previous = thread.getContextClassLoader();
            try {
                thread.setContextClassLoader(classpathLoader);
                com.tngtech.archunit.core.domain.JavaClasses imported = new com.tngtech.archunit.core.importer.ClassFileImporter().importUrl(resource);
                return imported.contain(name) ? imported.get(name) : type;
            } catch (RuntimeException e) {
                return type;
            } finally {
                thread.setContextClassLoader(previous);
            }
        });
    }

    static JavaClass topLevel(JavaClass type) {
        JavaClass current = type;
        while (current.getEnclosingClass().isPresent()) current = current.getEnclosingClass().get();
        return current;
    }

    /** The source file of a scanned class, found under the source roots by package and the class file's {@code SourceFile}; null without one. */
    String sourceFileOf(JavaClass type) {
        JavaClass top = topLevel(type);
        return sourceFiles.computeIfAbsent(top.getName(), name -> {
            Optional<String> fileName = top.getSource().flatMap(Source::getFileName);
            if (fileName.isEmpty()) return null;
            String relative = top.getPackageName().replace('.', '/') + (top.getPackageName().isEmpty() ? "" : "/") + fileName.get();
            for (Path root : input.sourceRoots()) {
                Path candidate = root.resolve(relative);
                if (Files.exists(candidate)) return session.locations().relativePath(candidate);
            }
            return input.sourceRoots().isEmpty() ? relative : session.locations().relativePath(input.sourceRoots().get(0).resolve(relative));
        });
    }

    /** A line-only span in the class's source file; null when the file is unknown. */
    SourceSpan lineOf(JavaClass type, int line) {
        String file = sourceFileOf(type);
        return file == null ? null : new SourceSpan(file, line, 0, line, 0);
    }
}
