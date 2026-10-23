package vision.noesis.scanner.model;

import java.util.List;
import java.util.stream.Collectors;

public final class CanonicalString {

    private CanonicalString() {}

    public static String of(TypeRef type) {
        if (type instanceof TypeRef.Named named) return named.type().canonicalPath() + arguments(named) + nullable(named.nullable());
        if (type instanceof TypeRef.TypeParameterRef parameter) {
            return (parameter.owner().kind() == NodeKindLetter.TYPE ? "!" : "!!") + parameter.ordinal() + nullable(parameter.nullable());
        }
        if (type instanceof TypeRef.Array array) return of(array.element()) + "[" + ",".repeat(array.rank() - 1) + "]" + nullable(array.nullable());
        if (type instanceof TypeRef.Tuple tuple) return "(" + tuple.elements().stream().map(element -> of(element.type())).collect(Collectors.joining(",")) + ")";
        if (type instanceof TypeRef.Function function) {
            String convention = function.callingConvention() == null ? "" : " " + function.callingConvention();
            String parameters = function.signature().parameters().stream().map(parameter -> of(parameter.type())).collect(Collectors.joining(","));
            String separator = function.signature().parameters().isEmpty() ? "" : ",";
            return "delegate*" + convention + "<" + parameters + separator + of(function.signature().returnType()) + ">";
        }
        if (type instanceof TypeRef.Structural structural) {
            return "{" + structural.members().stream().map(member -> member.name() + ":" + of(member.type())).collect(Collectors.joining(",")) + "}";
        }
        if (type instanceof TypeRef.Pointer pointer) return of(pointer.pointee()) + "*";
        if (type instanceof TypeRef.Union union) return join(union.members(), "|");
        if (type instanceof TypeRef.Intersection intersection) return join(intersection.members(), "&");
        if (type instanceof TypeRef.Literal literal) return literal.text();
        if (type instanceof TypeRef.Primitive primitive) return primitive.name() + nullable(primitive.nullable());
        if (type instanceof TypeRef.Dynamic) return "dynamic";
        if (type instanceof TypeRef.Void) return "void";
        if (type instanceof TypeRef.Unresolved unresolved) return "<unresolved:" + unresolved.text() + ">";
        if (type instanceof TypeRef.Other other) return "<other:" + other.text() + ">";
        throw new IllegalArgumentException("Unknown type reference: " + type);
    }

    private static String arguments(TypeRef.Named named) {
        if (named.unbound()) return "<>";
        if (named.typeArguments().isEmpty()) return "";
        return "[" + join(named.typeArguments(), ",") + "]";
    }

    private static String join(List<TypeRef> types, String separator) {
        return types.stream().map(CanonicalString::of).collect(Collectors.joining(separator));
    }

    private static String nullable(boolean nullable) {
        return nullable ? "?" : "";
    }
}
