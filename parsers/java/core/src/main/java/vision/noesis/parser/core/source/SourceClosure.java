package vision.noesis.parser.core.source;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.PackageElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import vision.noesis.parser.core.StubRegistry;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.StubKind;
import vision.noesis.parser.model.TypeRef;

/**
 * The external closure: every symbol outside the parsed modules that an id was built for, plus its containing types and
 * namespaces and, for a type, its base chain, each stub with the owning artifact. Runs once after both passes.
 */
final class SourceClosure {

    private final SourceContext c;
    private final StubRegistry stubs;
    private final Set<Element> seen = new HashSet<>();
    private final Deque<Element> pending = new ArrayDeque<>();

    private SourceClosure(SourceContext context) {
        this.c = context;
        this.stubs = context.builder.stubs();
    }

    static void collect(SourceContext context) {
        new SourceClosure(context).run();
    }

    /** Stubbing a type references its bases, so the referenced set grows while it drains. */
    private void run() {
        boolean progressed = true;
        while (progressed) {
            progressed = false;
            for (Element element : new java.util.ArrayList<>(c.ids.referencedElements())) {
                if (seen.contains(element) || !c.isStubbed(element)) continue;
                pending.add(element);
                progressed = true;
            }
            while (!pending.isEmpty()) {
                Element element = pending.poll();
                if (!seen.add(element)) continue;
                if (element instanceof TypeElement type) addType(type);
                else if (element instanceof ExecutableElement || element instanceof VariableElement) addMember(element);
            }
        }
    }

    private void addType(TypeElement type) {
        NodeId id = c.ids.type(type);
        NodeId artifact = c.artifactOf(type);
        if (!stubs.type(id, c.ids.nodeName(type), SourceDeclarations.typeKindOf(type), artifact)) return;
        TypeElement outer = SourceIds.enclosingType(type);
        if (outer != null) {
            pending.add(outer);
        } else {
            PackageElement pkg = c.javac.elements().getPackageOf(type);
            if (!pkg.isUnnamed()) stubs.namespaceChain(pkg.getQualifiedName().toString(), artifact);
        }
        addBaseChain(type, id);
    }

    /** EXTENDS and IMPLEMENTS of the stub, with the bases stubbed in turn; their members are not. */
    private void addBaseChain(TypeElement type, NodeId id) {
        if (type.getKind() == ElementKind.ANNOTATION_TYPE) return;
        TypeMirror superclass = type.getSuperclass();
        if (superclass.getKind() == TypeKind.DECLARED && !SourceDeclarations.isObject(superclass)) {
            stubs.baseEdge(new Edge.Extends(id, c.types.of(superclass)));
            pending.add(((DeclaredType) superclass).asElement());
        }
        boolean isInterface = type.getKind().isInterface();
        for (TypeMirror implemented : type.getInterfaces()) {
            if (implemented.getKind() != TypeKind.DECLARED) continue;
            TypeRef reference = c.types.of(implemented);
            stubs.baseEdge(isInterface ? new Edge.Extends(id, reference) : new Edge.Implements(id, reference));
            pending.add(((DeclaredType) implemented).asElement());
        }
    }

    private void addMember(Element member) {
        NodeId id = c.ids.member(member);
        StubKind kind = member instanceof ExecutableElement ? StubKind.METHOD : StubKind.FIELD;
        stubs.member(id, kind, c.ids.nodeName(member), c.artifactOf(member));
        TypeElement owner = SourceIds.enclosingType(member);
        if (owner != null) pending.add(owner);
    }
}
