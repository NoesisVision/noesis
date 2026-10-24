package vision.noesis.parser.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMember;
import com.tngtech.archunit.core.domain.JavaType;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.Set;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.StubRegistry;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.StubKind;
import vision.noesis.parser.model.TypeRef;

/** The external closure over ArchUnit's resolved classes: the same stubs and base chains the source engine writes. */
final class BytecodeClosure {

    private final BytecodeContext c;
    private final StubRegistry stubs;
    private final Set<String> seenTypes = new HashSet<>();
    private final Set<JavaMember> seenMembers = new HashSet<>();
    private final Deque<JavaClass> pending = new ArrayDeque<>();

    private BytecodeClosure(BytecodeContext context) {
        this.c = context;
        this.stubs = context.builder.stubs();
    }

    static void collect(BytecodeContext context) {
        new BytecodeClosure(context).run();
    }

    private void run() {
        boolean progressed = true;
        while (progressed) {
            progressed = false;
            for (JavaMember member : new ArrayList<>(c.ids.referencedMembers())) {
                if (seenMembers.contains(member) || !c.isStubbed(member.getOwner())) continue;
                seenMembers.add(member);
                addMember(member);
                progressed = true;
            }
            for (JavaClass type : new ArrayList<>(c.ids.referencedTypes())) {
                if (seenTypes.contains(type.getName()) || type.isPrimitive() || type.isArray() || !c.isStubbed(type)) continue;
                pending.add(type);
                progressed = true;
            }
            while (!pending.isEmpty()) addType(pending.poll());
        }
    }

    private void addType(JavaClass partial) {
        if (!seenTypes.add(partial.getName())) return;
        JavaClass type = c.fullyImported(partial);
        NodeId id = c.ids.type(type);
        NodeId artifact = c.artifactOf(type);
        if (!stubs.type(id, c.ids.nodeName(type), BytecodeDeclarations.typeKindOf(type), artifact)) return;
        if (type.getEnclosingClass().isPresent()) pending.add(type.getEnclosingClass().get());
        else if (!type.getPackageName().isEmpty()) stubs.namespaceChain(type.getPackageName(), artifact);
        if (!type.isFullyImported()) {
            c.builder.diagnostic(Diagnostics.info(Diagnostics.NOT_FULLY_IMPORTED, "Class " + type.getName() + " was not found on the classpath; its supertypes are unknown.", null));
            return;
        }
        if (type.isAnnotation()) return;
        type.getSuperclass().ifPresent(superclass -> {
            if (BytecodeDeclarations.isObject(superclass)) return;
            stubs.baseEdge(new Edge.Extends(id, c.types.of(superclass, BytecodeTypeRefs.Scope.of(type))));
            pending.add(superclass.toErasure());
        });
        for (JavaType implemented : BytecodeDeclarations.sortedInterfaces(type)) {
            TypeRef reference = c.types.of(implemented, BytecodeTypeRefs.Scope.of(type));
            stubs.baseEdge(type.isInterface() ? new Edge.Extends(id, reference) : new Edge.Implements(id, reference));
            pending.add(implemented.toErasure());
        }
    }

    private void addMember(JavaMember member) {
        NodeId id = c.ids.member(member);
        StubKind kind = member instanceof JavaField ? StubKind.FIELD : StubKind.METHOD;
        stubs.member(id, kind, BytecodeIds.nodeName(member), c.artifactOf(member.getOwner()));
        pending.add(member.getOwner());
    }
}
