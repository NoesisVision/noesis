package vision.noesis.scanner.core.java;

import java.net.URI;
import java.nio.file.Path;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ClasspathEntry;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.NodeId;

/**
 * Which artifact a classpath location belongs to: a jar or class directory the build tagged, or a JDK module
 * ({@code jrt:/java.base/...}) as a platform artifact.
 */
public final class ClasspathIndex {

    private final Map<Path, ArtifactDependency> byPath;
    private final Map<NodeId, ArtifactDependency> platform = new HashMap<>();

    private ClasspathIndex(Map<Path, ArtifactDependency> byPath) {
        this.byPath = byPath;
    }

    /** @param outputDirectories the class directories of every scanned artifact, in the order of {@code sourceArtifactIds}. */
    public static ClasspathIndex of(List<ArtifactInput> inputs, Collection<String> sourceArtifactIds, Collection<Path> outputDirectories) {
        Map<Path, ArtifactDependency> byPath = new HashMap<>();
        for (ArtifactInput artifact : inputs) {
            for (ClasspathEntry entry : artifact.classpath()) byPath.putIfAbsent(normalise(entry.path()), entry.dependency());
        }
        Iterator<String> ids = sourceArtifactIds.iterator();
        Iterator<Path> directories = outputDirectories.iterator();
        while (ids.hasNext() && directories.hasNext()) {
            byPath.putIfAbsent(normalise(directories.next()), new ArtifactDependency(JavaIds.artifact(ids.next()), ArtifactKind.SOURCE, null));
        }
        return new ClasspathIndex(byPath);
    }

    /** The artifact of a class file location: the jar it sits in, or the class directory it sits under. */
    public Optional<ArtifactDependency> dependencyOf(URI location) {
        if (location == null) return Optional.empty();
        String scheme = location.getScheme();
        if ("jar".equals(scheme)) {
            String spec = location.getSchemeSpecificPart();
            int bang = spec.indexOf("!/");
            return dependencyOfPath(Path.of(URI.create(bang < 0 ? spec : spec.substring(0, bang))));
        }
        if ("file".equals(scheme)) return dependencyOfPath(Path.of(location));
        return Optional.empty();
    }

    public Optional<ArtifactDependency> dependencyOfPath(Path path) {
        for (Path current = normalise(path); current != null; current = current.getParent()) {
            ArtifactDependency dependency = byPath.get(current);
            if (dependency != null) return Optional.of(dependency);
        }
        return Optional.empty();
    }

    /** A JDK module the declarations were bound against, labelled with the configured release. */
    public ArtifactDependency platform(String moduleName, int release) {
        NodeId id = JavaIds.platformArtifact(moduleName, release);
        return platform.computeIfAbsent(id, key -> new ArtifactDependency(key, ArtifactKind.PLATFORM, null));
    }

    public boolean isPlatform(NodeId artifact) {
        return platform.containsKey(artifact);
    }

    private static Path normalise(Path path) {
        return path.toAbsolutePath().normalize();
    }
}
