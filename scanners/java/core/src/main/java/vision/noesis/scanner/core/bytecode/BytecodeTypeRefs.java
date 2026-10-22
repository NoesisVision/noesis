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
import java.util.Optional;
import vision.noesis.scanner.core.java.JavaPrimitives;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.NodeKindLetter;
import vision.noesis.scanner.model.TypeRef;

/**
 * Builds type references from ArchUnit's generic types. An environment substitutes type variables when a supertype is
 * read through a subtype's instantiation ({@code ArrayList<String>} makes {@code List<E>} into {@code List<String>}).
 *
 * <p>A type variable is resolved by name in the {@link Scope} the signature was read in, the way the language scopes
 * it: the method's own type parameters, then the declaring class's, then the enclosing classes' and methods'. ArchUnit's
 * own choice of owner is the fallback only: it collects the candidates of a nested class and its enclosing classes in a
 * hash set, so for {@code ImmutableList<E>.Builder<E>} it names either {@code E} depending on the run.
 */
final class BytecodeTypeRefs {

    private static final NodeId TYPE_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.TYPE, "?");
    private static final NodeId METHOD_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.METHOD, "?");

    /** Where a signature was read: a method (its parameters, return type, throws, bounds) or a class (supertypes, fields, bounds). */
    record Scope(JavaCodeUnit unit, JavaClass type) {
        static final Scope NONE = new Scope(null, null);

        static Scope of(JavaClass type) {
            return new Scope(null, type);
        }

        static Scope of(JavaCodeUnit unit) {
            return new Scope(unit, unit.getOwner());
        }
    }

    /** A type variable's declaration: a method or a class, and the variable's position among its type parameters. */
    private record Declaration(JavaCodeUnit unit, JavaClass type, int index) {
        String key(String name) {
            return (unit != null ? unit.getFullName() : type.getName()) + "<" + name + ">";
        }
    }

    private final BytecodeContext context;

    BytecodeTypeRefs(BytecodeContext context) {
        this.context = context;
    }

    String idCanonical(JavaType type, Scope scope) {
        return of(type, true, Map.of(), scope).canonical();
    }

    /** A reference without type variables in it: a class, an annotation type, an {@code instanceof} operand. */
    TypeRef of(JavaType type) {
        return of(type, false, Map.of(), Scope.NONE);
    }

    TypeRef of(JavaType type, Scope scope) {
        return of(type, false, Map.of(), scope);
    }

    /** @param environment type variables bound by an enclosing instantiation, keyed by {@link #variableKey}. */
    TypeRef of(JavaType type, boolean forId, Map<String, TypeRef> environment, Scope scope) {
        if (type instanceof JavaClass javaClass) return ofClass(javaClass, forId);
        if (type instanceof JavaParameterizedType parameterized) {
            JavaClass erasure = parameterized.toErasure();
            List<TypeRef> arguments = new ArrayList<>();
            for (JavaType argument : parameterized.getActualTypeArguments()) arguments.add(of(argument, forId, environment, scope));
            return new TypeRef.Named(context.ids.type(erasure), arguments, false, false);
        }
        if (type instanceof JavaTypeVariable<?> variable) return variable(variable, forId, environment, scope);
        if (type instanceof JavaWildcardType wildcard) return wildcard(wildcard, forId, environment, scope);
        if (type instanceof JavaGenericArrayType array) return new TypeRef.Array(of(array.getComponentType(), forId, environment, scope), 1, false);
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

    private TypeRef variable(JavaTypeVariable<?> variable, boolean forId, Map<String, TypeRef> environment, Scope scope) {
        Optional<Declaration> declaration = declare(variable.getName(), scope).or(() -> declaredByArchUnit(variable));
        if (declaration.isEmpty()) return new TypeRef.Other(variable.getName());
        Declaration declared = declaration.get();
        TypeRef bound = environment.get(declared.key(variable.getName()));
        if (bound != null) return bound;
        if (declared.unit() != null) {
            NodeId ownerId = forId ? METHOD_OWNER_PLACEHOLDER : context.ids.member(declared.unit());
            return new TypeRef.TypeParameterRef(ownerId, declared.index(), false);
        }
        NodeId ownerId = forId ? TYPE_OWNER_PLACEHOLDER : context.ids.type(declared.type());
        return new TypeRef.TypeParameterRef(ownerId, innerOffset(declared.type()) + declared.index(), false);
    }

    /** The innermost declaration of a type parameter with that name around the scope. */
    private static Optional<Declaration> declare(String name, Scope scope) {
        if (scope.unit() != null) {
            int index = indexOf(scope.unit().getTypeParameters(), name);
            if (index >= 0) return Optional.of(new Declaration(scope.unit(), null, index));
        }
        for (JavaClass type = scope.type(); type != null; type = type.getEnclosingClass().orElse(null)) {
            int index = indexOf(type.getTypeParameters(), name);
            if (index >= 0) return Optional.of(new Declaration(null, type, index));
            Optional<JavaCodeUnit> enclosingUnit = type.getEnclosingCodeUnit();
            if (enclosingUnit.isPresent()) {
                int unitIndex = indexOf(enclosingUnit.get().getTypeParameters(), name);
                if (unitIndex >= 0) return Optional.of(new Declaration(enclosingUnit.get(), null, unitIndex));
            }
        }
        return Optional.empty();
    }

    private static Optional<Declaration> declaredByArchUnit(JavaTypeVariable<?> variable) {
        Object owner = variable.getOwner();
        if (owner instanceof JavaClass type) return Optional.of(new Declaration(null, type, Math.max(indexOf(type.getTypeParameters(), variable.getName()), 0)));
        if (owner instanceof JavaCodeUnit unit) return Optional.of(new Declaration(unit, null, Math.max(indexOf(unit.getTypeParameters(), variable.getName()), 0)));
        return Optional.empty();
    }

    /** The environment key of a class's own type parameter, as {@link JavaClass#getTypeParameters()} declares it. */
    static String variableKey(JavaTypeVariable<JavaClass> parameter) {
        return parameter.getOwner().getName() + "<" + parameter.getName() + ">";
    }

    private static int indexOf(List<? extends JavaTypeVariable<?>> parameters, String name) {
        for (int i = 0; i < parameters.size(); i++) {
            if (parameters.get(i).getName().equals(name)) return i;
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

    private TypeRef wildcard(JavaWildcardType wildcard, boolean forId, Map<String, TypeRef> environment, Scope scope) {
        if (!wildcard.getLowerBounds().isEmpty()) return new TypeRef.Other("? super " + of(wildcard.getLowerBounds().get(0), forId, environment, scope).canonical());
        for (JavaType upper : wildcard.getUpperBounds()) {
            if (upper instanceof JavaClass javaClass && javaClass.getName().equals("java.lang.Object")) continue;
            return new TypeRef.Other("? extends " + of(upper, forId, environment, scope).canonical());
        }
        return new TypeRef.Other("?");
    }
}
