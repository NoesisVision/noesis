package vision.noesis.scanner.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaConstructor;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMember;
import com.tngtech.archunit.core.domain.JavaStaticInitializer;
import com.tngtech.archunit.core.domain.JavaType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.NodeId;

/** Stable ids from ArchUnit's classes and members: the same binary names javac has, so both engines agree. */
final class BytecodeIds {

    private final BytecodeContext context;
    private final Map<String, String> typePaths = new HashMap<>();
    private final Set<JavaClass> referencedTypes = new LinkedHashSet<>();
    private final Set<JavaMember> referencedMembers = new LinkedHashSet<>();

    BytecodeIds(BytecodeContext context) {
        this.context = context;
    }

    Set<JavaClass> referencedTypes() {
        return referencedTypes;
    }

    Set<JavaMember> referencedMembers() {
        return referencedMembers;
    }

    NodeId type(JavaClass type) {
        referencedTypes.add(type);
        return JavaIds.type(typePath(type));
    }

    String typePath(JavaClass type) {
        String cached = typePaths.get(type.getName());
        if (cached != null) return cached;
        List<JavaClass> chain = new ArrayList<>();
        for (JavaClass current = context.fullyImported(type); current != null; current = current.getEnclosingClass().map(context::fullyImported).orElse(null)) chain.add(0, current);
        List<String> names = new ArrayList<>();
        List<Integer> arities = new ArrayList<>();
        for (JavaClass level : chain) {
            names.add(segment(level));
            arities.add(level.getTypeParameters().size());
        }
        String path = JavaIds.typePath(type.getPackageName(), names, arities);
        typePaths.put(type.getName(), path);
        return path;
    }

    /** The segment a class adds to the binary name: its simple name, or the compiler's suffix for a local or anonymous class. */
    static String segment(JavaClass type) {
        String binary = type.getName();
        JavaClass outer = type.getEnclosingClass().orElse(null);
        if (outer == null) {
            int dot = binary.lastIndexOf('.');
            return dot < 0 ? binary : binary.substring(dot + 1);
        }
        String prefix = outer.getName() + "$";
        return binary.startsWith(prefix) ? binary.substring(prefix.length()) : type.getSimpleName();
    }

    String nodeName(JavaClass type) {
        return type.isAnonymousClass() ? segment(type) : type.getSimpleName();
    }

    static String nodeName(JavaMember member) {
        if (member instanceof JavaConstructor) return JavaIds.CONSTRUCTOR_NAME;
        if (member instanceof JavaStaticInitializer) return JavaIds.STATIC_INITIALIZER_NAME;
        return member.getName();
    }

    NodeId member(JavaMember member) {
        referencedMembers.add(member);
        if (member instanceof JavaField field) return JavaIds.field(typePath(field.getOwner()), field.getName());
        JavaCodeUnit unit = (JavaCodeUnit) member;
        List<String> parameters = new ArrayList<>();
        for (JavaType parameter : declaredParameterTypes(unit)) parameters.add(context.types.idCanonical(parameter, BytecodeTypeRefs.Scope.of(unit)));
        return JavaIds.method(typePath(unit.getOwner()), nodeName(unit), unit.getTypeParameters().size(), parameters);
    }

    /**
     * The parameters the source declares: an enum constructor's name and ordinal and an inner class constructor's outer
     * instance are the compiler's, and javac's generic signature already leaves them out.
     */
    static int syntheticLeadingParameters(JavaCodeUnit unit) {
        if (!(unit instanceof JavaConstructor)) return 0;
        JavaClass owner = unit.getOwner();
        List<JavaClass> raw = unit.getRawParameterTypes();
        if (owner.isEnum()) return raw.size() >= 2 ? 2 : 0;
        if (BytecodeTypeRefs.isInner(owner) && !raw.isEmpty() && owner.getEnclosingClass().map(outer -> outer.equals(raw.get(0))).orElse(false)) return 1;
        return 0;
    }

    static List<JavaType> declaredParameterTypes(JavaCodeUnit unit) {
        List<JavaType> types = unit.getParameterTypes();
        int synthetic = syntheticLeadingParameters(unit);
        return types.size() == unit.getRawParameterTypes().size() ? types.subList(synthetic, types.size()) : types;
    }

    /** An unresolved call target, from its erased parameter types; the owner is still stubbed. */
    NodeId unresolvedMethod(JavaClass owner, String name, List<JavaClass> rawParameterTypes) {
        List<String> parameters = new ArrayList<>();
        for (JavaClass parameter : rawParameterTypes) parameters.add(context.types.idCanonical(parameter, BytecodeTypeRefs.Scope.NONE));
        String spelled = name.equals(JavaConstructor.CONSTRUCTOR_NAME) ? JavaIds.CONSTRUCTOR_NAME : name;
        return JavaIds.method(typePath(owner), spelled, 0, parameters);
    }

    NodeId staticInitializer(JavaClass owner) {
        return JavaIds.method(typePath(owner), JavaIds.STATIC_INITIALIZER_NAME, 0, List.of());
    }
}
