package vision.noesis.scanner.core.source;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.NestingKind;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.TypeParameterElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.TypeKind;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import vision.noesis.scanner.model.NodeId;
import vision.noesis.scanner.model.NodeKindLetter;
import vision.noesis.scanner.model.TypeRef;

/** Builds type references from javac's type mirrors: the eight primitives by keyword, generics CLR-flattened, raw types unbound. */
final class SourceTypeRefs {

    private static final NodeId TYPE_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.TYPE, "?");
    private static final NodeId METHOD_OWNER_PLACEHOLDER = NodeId.of(NodeKindLetter.METHOD, "?");

    private final SourceContext context;

    SourceTypeRefs(SourceContext context) {
        this.context = context;
    }

    /** Inside an id: type parameters as {@code !n}/{@code !!n} with no owner. */
    String idCanonical(TypeMirror type) {
        return of(type, true).canonical();
    }

    TypeRef of(TypeMirror type) {
        return of(type, false);
    }

    TypeRef of(TypeMirror type, boolean forId) {
        if (type == null) return new TypeRef.Unresolved("");
        switch (type.getKind()) {
            case BOOLEAN: case BYTE: case CHAR: case SHORT: case INT: case LONG: case FLOAT: case DOUBLE:
                return new TypeRef.Primitive(type.getKind().name().toLowerCase(Locale.ROOT), false);
            case VOID:
                return new TypeRef.Void();
            case ARRAY:
                return new TypeRef.Array(of(((ArrayType) type).getComponentType(), forId), 1, false);
            case DECLARED:
                return named((DeclaredType) type, forId);
            case TYPEVAR:
                return typeParameter((TypeVariable) type, forId);
            case WILDCARD:
                return wildcard((WildcardType) type, forId);
            case INTERSECTION:
                return new TypeRef.Intersection(all(((IntersectionType) type).getBounds(), forId));
            case UNION:
                return new TypeRef.Union(all(((UnionType) type).getAlternatives(), forId));
            case ERROR:
                return new TypeRef.Unresolved(type.toString());
            default:
                return new TypeRef.Other(type.toString());
        }
    }

    private List<TypeRef> all(List<? extends TypeMirror> types, boolean forId) {
        List<TypeRef> refs = new ArrayList<>(types.size());
        for (TypeMirror type : types) refs.add(of(type, forId));
        return refs;
    }

    private TypeRef named(DeclaredType declared, boolean forId) {
        TypeElement element = (TypeElement) declared.asElement();
        NodeId id = context.ids.type(element);
        List<TypeRef> arguments = flattenedArguments(declared, forId);
        boolean unbound = arguments.isEmpty() && totalArity(element) > 0;
        return new TypeRef.Named(id, arguments, unbound, false);
    }

    /** Arguments of the enclosing (inner-class) chain first, then the type's own. */
    private List<TypeRef> flattenedArguments(DeclaredType declared, boolean forId) {
        List<DeclaredType> chain = new ArrayList<>();
        for (TypeMirror current = declared; current != null && current.getKind() == TypeKind.DECLARED; current = ((DeclaredType) current).getEnclosingType()) {
            chain.add(0, (DeclaredType) current);
        }
        List<TypeRef> arguments = new ArrayList<>();
        for (DeclaredType level : chain) {
            for (TypeMirror argument : level.getTypeArguments()) arguments.add(of(argument, forId));
        }
        return arguments;
    }

    /** The type's own parameters plus those of the enclosing types it is an inner class of. */
    static int totalArity(TypeElement type) {
        return type.getTypeParameters().size() + innerOffset(type);
    }

    /** CLR-flattened position: the enclosing types' parameters count first when the type is an inner class. */
    static int innerOffset(TypeElement type) {
        if (!isInner(type)) return 0;
        TypeElement outer = SourceIds.enclosingType(type);
        return outer == null ? 0 : outer.getTypeParameters().size() + innerOffset(outer);
    }

    /** A non-static class nested in a type, or a local or anonymous class in an instance context. */
    static boolean isInner(TypeElement type) {
        if (type.getNestingKind() == NestingKind.TOP_LEVEL) return false;
        if (type.getKind() != ElementKind.CLASS) return false;
        if (type.getModifiers().contains(Modifier.STATIC)) return false;
        for (Element current = type.getEnclosingElement(); current != null; current = current.getEnclosingElement()) {
            if (current instanceof TypeElement) return true;
            if (current instanceof ExecutableElement method) return !method.getModifiers().contains(Modifier.STATIC);
            if (current.getKind() == ElementKind.PACKAGE) return false;
        }
        return false;
    }

    static int ordinal(TypeParameterElement parameter) {
        Element generic = parameter.getGenericElement();
        int index = generic instanceof TypeElement type ? type.getTypeParameters().indexOf(parameter)
                : generic instanceof ExecutableElement method ? method.getTypeParameters().indexOf(parameter) : -1;
        if (index < 0) index = 0;
        return generic instanceof TypeElement type ? innerOffset(type) + index : index;
    }

    private TypeRef typeParameter(TypeVariable variable, boolean forId) {
        Element element = variable.asElement();
        if (!(element instanceof TypeParameterElement parameter) || parameter.getGenericElement() == null) {
            return new TypeRef.Other(variable.toString());
        }
        Element generic = parameter.getGenericElement();
        boolean methodLevel = generic instanceof ExecutableElement;
        if (!(generic instanceof TypeElement) && !methodLevel) return new TypeRef.Other(variable.toString());
        NodeId owner = forId ? (methodLevel ? METHOD_OWNER_PLACEHOLDER : TYPE_OWNER_PLACEHOLDER) : context.ids.member(generic);
        return new TypeRef.TypeParameterRef(owner, ordinal(parameter), false);
    }

    private TypeRef wildcard(WildcardType wildcard, boolean forId) {
        if (wildcard.getExtendsBound() != null) return new TypeRef.Other("? extends " + of(wildcard.getExtendsBound(), forId).canonical());
        if (wildcard.getSuperBound() != null) return new TypeRef.Other("? super " + of(wildcard.getSuperBound(), forId).canonical());
        return new TypeRef.Other("?");
    }
}
