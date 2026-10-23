package vision.noesis.parser.core.java;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.NodeKindLetter;

/**
 * The id grammar from neutral inputs both engines have: binary names and arities. {@code T:com.acme.Outer`1+Inner},
 * {@code M:com.acme.Order#.ctor(java.lang.String)}, {@code F:com.acme.Order.lines}.
 */
public final class JavaIds {

    public static final String CONSTRUCTOR_NAME = ".ctor";
    public static final String STATIC_INITIALIZER_NAME = ".cctor";

    private JavaIds() {}

    /** A parsed module: {@code A:<artifactId>}. */
    public static NodeId artifact(String artifactId) {
        return NodeId.of(NodeKindLetter.ARTIFACT, artifactId);
    }

    /**
     * The name a module of a build has in its artifact id: its own short name ({@code api}), or its qualified name
     * ({@code com.acme.billing:api}, a Gradle project's path {@code billing:api}) when another module of the build has
     * the same short name. Two modules never share an id, and an unambiguous build keeps the short ids.
     *
     * @param namesInBuild the short names of every module of the build, repeated as often as they occur
     */
    public static String moduleName(String name, String qualifiedName, Collection<String> namesInBuild) {
        return Collections.frequency(namesInBuild, name) > 1 ? qualifiedName : name;
    }

    /** A library on the classpath: {@code A:<groupId>:<artifactId>@<version>}. */
    public static NodeId libraryArtifact(String packageId, String version) {
        return NodeId.of(NodeKindLetter.ARTIFACT, packageId + "@" + version);
    }

    /** A JDK module: {@code A:java.base@17}. */
    public static NodeId platformArtifact(String moduleName, int release) {
        return NodeId.of(NodeKindLetter.ARTIFACT, moduleName + "@" + release);
    }

    public static NodeId namespace(String dottedName) {
        return NodeId.of(NodeKindLetter.NAMESPACE, dottedName);
    }

    /**
     * The type path of a binary name: {@code com.acme.Outer$Inner} with the arity of each nesting level becomes
     * {@code com.acme.Outer`1+Inner}. {@code arities} lists one entry per level, outermost first.
     */
    public static String typePath(String packageName, List<String> simpleNames, List<Integer> arities) {
        StringBuilder path = new StringBuilder(packageName);
        for (int i = 0; i < simpleNames.size(); i++) {
            path.append(i == 0 ? (packageName.isEmpty() ? "" : ".") : "+").append(simpleNames.get(i));
            if (arities.get(i) > 0) path.append('`').append(arities.get(i));
        }
        return path.toString();
    }

    public static NodeId type(String typePath) {
        return NodeId.of(NodeKindLetter.TYPE, typePath);
    }

    /** {@code M:<type path>#<name>`<arity>(<parameter canonical strings>)}. */
    public static NodeId method(String typePath, String name, int arity, List<String> parameterCanonicals) {
        return NodeId.of(NodeKindLetter.METHOD, typePath + "#" + name + (arity > 0 ? "`" + arity : "") + "(" + String.join(",", parameterCanonicals) + ")");
    }

    public static NodeId field(String typePath, String name) {
        return NodeId.of(NodeKindLetter.FIELD, typePath + "." + name);
    }
}
