package vision.noesis.parser.core.source;

import com.sun.source.util.TreePath;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ModuleElement;
import javax.lang.model.element.TypeElement;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.ModelBuilder;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.NodeId;

/** Everything the source engine's mappers of one artifact share. */
final class SourceContext {

    final ArtifactInput input;
    final ParseSession session;
    final JavacSession javac;
    final ModelBuilder builder;
    final SourceIds ids;
    final SourceTypeRefs types;
    final SourceAnnotations annotations;
    final SourceLocations locations;
    final NodeId artifactId;

    private final Map<TypeElement, Optional<ArtifactDependency>> artifactOfTopLevel = new HashMap<>();

    SourceContext(ArtifactInput input, ParseSession session, JavacSession javac, ModelBuilder builder, NodeId artifactId) {
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

    /**
     * Declared outside this compilation: read from the classpath or the platform. A tree alone does not make a type
     * the artifact's own; it must come from one of the units parsed from the source roots.
     */
    boolean isExternal(Element element) {
        TypeElement top = topLevelTypeOf(element);
        if (top == null) return false;
        TreePath path = javac.trees().getPath(top);
        return path == null || javac.unitOf(path.getCompilationUnit().getSourceFile().toUri()) != path.getCompilationUnit();
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

    /**
     * A platform module is labelled with the release the sources were bound against, which is not the requested one
     * when javac does not support that ({@code NS1009}).
     */
    private Optional<ArtifactDependency> locate(TypeElement top) {
        ModuleElement module = javac.elements().getModuleOf(top);
        if (module != null && !module.isUnnamed()) {
            return Optional.of(session.classpath().platform(module.getQualifiedName().toString(), javac.release()));
        }
        String binaryName = javac.elements().getBinaryName(top).toString();
        URI location = javac.classFileOf(binaryName);
        // No module at all: a release before modules, whose platform classes are not on the classpath.
        if (location == null && module == null) {
            return javac.platformModuleOf(binaryName).map(name -> session.classpath().platform(name, javac.release()));
        }
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
