package vision.noesis.scanner.core.bytecode;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaGenericArrayType;
import com.tngtech.archunit.core.domain.JavaParameterizedType;
import com.tngtech.archunit.core.domain.JavaType;
import com.tngtech.archunit.core.domain.JavaTypeVariable;
import com.tngtech.archunit.core.domain.JavaWildcardType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import vision.noesis.scanner.core.java.JavaPrimitives;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.NodeKindLetter;
import vision.noesis.scanner.model.TypeRef;

/**
 * Builds type references from ArchUnit's generic types. An environment substitutes type variables when a supertype is
 * read through a subtype's instantiation ({@code ArrayList<String>} makes {@code List<E>} into {@code List<String>}).
 */
final class BytecodeTypeRefs {

    private static final NodeId TYPE_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.TYPE, "?");
    private static final NodeId METHOD_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.METHOD, "?");

    private final BytecodeContext context;

    BytecodeTypeRefs(BytecodeContext context) {
        this.context = context;
    }

    String idCanonical(JavaType type) {
        return of(type, true, Map.of()).canonical();
    }

    TypeRef of(JavaType type) {
        return of(type, false, Map.of());
    }

    /** @param environment type variables bound by an enclosing instantiation, keyed by {@link #variableKey}. */
    TypeRef of(JavaType type, boolean forId, Map<String, TypeRef> environment) {
        if (type instanceof JavaClass javaClass) return ofClass(javaClass, forId);
        if (type instanceof JavaParameterizedType parameterized) {
            JavaClass erasure = parameterized.toErasure();
            List<TypeRef> arguments = new ArrayList<>();
            for (JavaType argument : parameterized.getActualTypeArguments()) arguments.add(of(argument, forId, environment));
            return new TypeRef.Named(context.ids.type(erasure), arguments, false, false);
        }
        if (type instanceof JavaTypeVariable<?> variable) return variable(variable, forId, environment);
        if (type instanceof JavaWildcardType wildcard) return wildcard(wildcard, forId, environment);
        if (type instanceof JavaGenericArrayType array) return new TypeRef.Array(of(array.getComponentType(), forId, environment), 1, false);
        return new TypeRef.Other(type.getName());
    }

    private TypeRef ofClass(JavaClass javaClass, boolean forId) {
        if (javaClass.isPrimitive()) {
            return javaClass.getName().equals("void") ? new TypeRef.Void() : new TypeRef.Primitive(javaClass.getName(), false);
        }
        if (JavaPrimitives.isPrimitive(javaClass.getName())) return new TypeRef.Primitive(javaClass.getName(), false);
        if (javaClass.isArray()) return new TypeRef.Array(ofClass(javaClass.getComponentType(), forId), 1, false);
        JavaClass imported = context.fullyImported(javaClass);
        boolean raw = !imported.getTypeParameters().isEmpty();
        return new TypeRef.Named(context.ids.type(imported), List.of(), raw, false);
    }

    private TypeRef variable(JavaTypeVariable<?> variable, boolean forId, Map<String, TypeRef> environment) {
        TypeRef bound = environment.get(variableKey(variable));
        if (bound != null) return bound;
        Object owner = variable.getOwner();
        if (owner instanceof JavaClass type) {
            int index = indexOf(type.getTypeParameters(), variable);
            NodeId ownerId = forId ? TYPE_OWNER_PLACEHOLDER : context.ids.type(type);
            return new TypeRef.TypeParameterRef(ownerId, innerOffset(type) + Math.max(index, 0), false);
        }
        if (owner instanceof JavaCodeUnit unit) {
            int index = indexOf(unit.getTypeParameters(), variable);
            NodeId ownerId = forId ? METHOD_OWNER_PLACEHOLDER : context.ids.member(unit);
            return new TypeRef.TypeParameterRef(ownerId, Math.max(index, 0), false);
        }
        return new TypeRef.Other(variable.getName());
    }

    static String variableKey(JavaTypeVariable<?> variable) {
        Object owner = variable.getOwner();
        String ownerName = owner instanceof JavaClass type ? type.getName() : owner instanceof JavaCodeUnit unit ? unit.getFullName() : String.valueOf(owner);
        return ownerName + "<" + variable.getName() + ">";
    }

    private static int indexOf(List<? extends JavaTypeVariable<?>> parameters, JavaTypeVariable<?> variable) {
        for (int i = 0; i < parameters.size(); i++) {
            if (parameters.get(i).getName().equals(variable.getName())) return i;
        }
        return -1;
    }

    /** CLR-flattened position: the enclosing types' parameters count first when the type is an inner class. */
    static int innerOffset(JavaClass type) {
        if (!isInner(type)) return 0;
        JavaClass outer = type.getEnclosingClass().orElse(null);
        return outer == null ? 0 : outer.getTypeParameters().size() + innerOffset(outer);
    }

    /** A non-static member class, or a local or anonymous class in an instance context. */
    static boolean isInner(JavaClass type) {
        if (type.isTopLevelClass() || type.isInterface() || type.isEnum() || type.isRecord() || type.isAnnotation()) return false;
        if (type.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.STATIC)) return false;
        if (type.isLocalClass() || type.isAnonymousClass()) {
            return type.getEnclosingCodeUnit().map(unit -> !unit.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.STATIC)).orElse(true);
        }
        return true;
    }

    private TypeRef wildcard(JavaWildcardType wildcard, boolean forId, Map<String, TypeRef> environment) {
        if (!wildcard.getLowerBounds().isEmpty()) return new TypeRef.Other("? super " + of(wildcard.getLowerBounds().get(0), forId, environment).canonical());
        for (JavaType upper : wildcard.getUpperBounds()) {
            if (upper instanceof JavaClass javaClass && javaClass.getName().equals("java.lang.Object")) continue;
            return new TypeRef.Other("? extends " + of(upper, forId, environment).canonical());
        }
        return new TypeRef.Other("?");
    }
}
