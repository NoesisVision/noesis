package vision.noesis.scanner.core.source;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ModuleElement;
import javax.lang.model.element.TypeElement;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.NodeId;

/** Everything the source engine's mappers of one artifact share. */
final class SourceContext {

    final ArtifactInput input;
    final ScanSession session;
    final JavacSession javac;
    final ModelBuilder builder;
    final SourceIds ids;
    final SourceTypeRefs types;
    final SourceAnnotations annotations;
    final SourceLocations locations;
    final NodeId artifactId;

    private final Map<TypeElement, Optional<ArtifactDependency>> artifactOfTopLevel = new HashMap<>();

    SourceContext(ArtifactInput input, ScanSession session, JavacSession javac, ModelBuilder builder, NodeId artifactId) {
        this.input = input;
        this.session = session;
        this.javac = javac;
        this.builder = builder;
        this.artifactId = artifactId;
        this.ids = new SourceIds(this);
        this.types = new SourceTypeRefs(this);
        this.annotations = new SourceAnnotations(this);
        this.locations = new SourceLocations(this);
    }

    /** Declared outside this compilation: read from the classpath or the platform. */
    boolean isExternal(Element element) {
        TypeElement top = topLevelTypeOf(element);
        if (top == null) return false;
        return javac.trees().getPath(top) == null;
    }

    /** External and not a sibling module of the build: the symbol has no model file and is referenced through a stub. */
    boolean isStubbed(Element element) {
        if (!isExternal(element)) return false;
        Optional<ArtifactDependency> dependency = dependencyOf(element);
        return dependency.map(d -> d.kind() != ArtifactKind.SOURCE).orElse(true);
    }

    /** The artifact an external element comes from: a JDK module, a classpath jar or a sibling module's classes. */
    Optional<ArtifactDependency> dependencyOf(Element element) {
        TypeElement top = topLevelTypeOf(element);
        if (top == null) return Optional.empty();
        return artifactOfTopLevel.computeIfAbsent(top, this::locate);
    }

    NodeId artifactOf(Element element) {
        return dependencyOf(element).map(ArtifactDependency::id).orElse(null);
    }

    private Optional<ArtifactDependency> locate(TypeElement top) {
        ModuleElement module = javac.elements().getModuleOf(top);
        if (module != null && !module.isUnnamed()) {
            return Optional.of(session.classpath().platform(module.getQualifiedName().toString(), input.release()));
        }
        URI location = javac.classFileOf(javac.elements().getBinaryName(top).toString());
        return session.classpath().dependencyOf(location);
    }

    static TypeElement topLevelTypeOf(Element element) {
        TypeElement top = null;
        for (Element current = element; current != null; current = current.getEnclosingElement()) {
            if (current instanceof TypeElement type) top = type;
            if (current.getKind() == ElementKind.PACKAGE || current.getKind() == ElementKind.MODULE) break;
        }
        return top;
    }
}
