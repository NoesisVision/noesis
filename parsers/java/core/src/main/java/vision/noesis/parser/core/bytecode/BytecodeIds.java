package vision.noesis.parser.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaConstructor;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMember;
import com.tngtech.archunit.core.domain.JavaParameter;
import com.tngtech.archunit.core.domain.JavaStaticInitializer;
import com.tngtech.archunit.core.domain.JavaType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.NodeId;

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
        for (DeclaredParameter parameter : declaredParameters(unit)) parameters.add(context.types.idCanonical(parameter.type(), BytecodeTypeRefs.Scope.of(unit)));
        return JavaIds.method(typePath(unit.getOwner()), nodeName(unit), unit.getTypeParameters().size(), parameters);
    }

    /** A parameter the source declares: its index among the descriptor's parameters, its (generic) type and ArchUnit's view of it. */
    record DeclaredParameter(int rawIndex, JavaType type, JavaParameter parameter) {}

    /**
     * The parameters the source declares, without the compiler's: an inner class constructor's outer instance, the
     * locals a local or anonymous class captures, an enum constructor's name and ordinal. The {@code MethodParameters}
     * attribute flags them; without it, the leading ones are told by position. javac's generic signature, when there
     * is one, already leaves them out.
     */
    List<DeclaredParameter> declaredParameters(JavaCodeUnit unit) {
        List<JavaParameter> all = unit.getParameters();
        List<JavaType> types = unit.getParameterTypes();
        int raw = unit.getRawParameterTypes().size();
        List<Integer> declared = declaredIndexes(unit, raw);
        List<DeclaredParameter> parameters = new ArrayList<>();
        if (all.size() == raw) {
            for (int index : declared) parameters.add(new DeclaredParameter(index, types.get(index), all.get(index)));
        } else {
            for (int j = 0; j < all.size(); j++) {
                int index = declared.size() == all.size() ? declared.get(j) : raw - all.size() + j;
                parameters.add(new DeclaredParameter(index, types.get(j), all.get(j)));
            }
        }
        return parameters;
    }

    private List<Integer> declaredIndexes(JavaCodeUnit unit, int raw) {
        ClassFileDetails.MethodDetails details = context.details.method(unit.getOwner().getName(), unit.getName(), unit.getDescriptor());
        List<Integer> indexes = new ArrayList<>();
        boolean flagged = details != null && details.parameterFlags() != null && details.parameterFlags().size() == raw;
        int leading = flagged ? (takesOuterInstance(unit) ? 1 : 0) : syntheticLeadingParameters(unit);
        for (int i = 0; i < raw; i++) {
            if (i >= leading && !(flagged && details.isSynthetic(i))) indexes.add(i);
        }
        return indexes;
    }

    /** The compiler's leading constructor parameters told by position, for class files without {@code MethodParameters}. */
    static int syntheticLeadingParameters(JavaCodeUnit unit) {
        if (!(unit instanceof JavaConstructor)) return 0;
        if (unit.getOwner().isEnum()) return unit.getRawParameterTypes().size() >= 2 ? 2 : 0;
        return takesOuterInstance(unit) ? 1 : 0;
    }

    /** An inner class's constructor takes the enclosing instance first. */
    private static boolean takesOuterInstance(JavaCodeUnit unit) {
        if (!(unit instanceof JavaConstructor)) return false;
        JavaClass owner = unit.getOwner();
        List<JavaClass> raw = unit.getRawParameterTypes();
        return BytecodeTypeRefs.isInner(owner) && !raw.isEmpty() && owner.getEnclosingClass().map(outer -> outer.equals(raw.get(0))).orElse(false);
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
