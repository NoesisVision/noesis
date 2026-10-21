package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;

/** A structural reference to a type; no language bag, so single-language refinements keep neutral defaults. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = TypeRef.Named.class, name = "named"),
    @JsonSubTypes.Type(value = TypeRef.TypeParameterRef.class, name = "typeParameter"),
    @JsonSubTypes.Type(value = TypeRef.Array.class, name = "array"),
    @JsonSubTypes.Type(value = TypeRef.Tuple.class, name = "tuple"),
    @JsonSubTypes.Type(value = TypeRef.Function.class, name = "function"),
    @JsonSubTypes.Type(value = TypeRef.Structural.class, name = "structural"),
    @JsonSubTypes.Type(value = TypeRef.Pointer.class, name = "pointer"),
    @JsonSubTypes.Type(value = TypeRef.Union.class, name = "union"),
    @JsonSubTypes.Type(value = TypeRef.Intersection.class, name = "intersection"),
    @JsonSubTypes.Type(value = TypeRef.Literal.class, name = "literal"),
    @JsonSubTypes.Type(value = TypeRef.Primitive.class, name = "primitive"),
    @JsonSubTypes.Type(value = TypeRef.Dynamic.class, name = "dynamic"),
    @JsonSubTypes.Type(value = TypeRef.Void.class, name = "void"),
    @JsonSubTypes.Type(value = TypeRef.Unresolved.class, name = "unresolved"),
    @JsonSubTypes.Type(value = TypeRef.Other.class, name = "other"),
})
public sealed interface TypeRef {

    /** The grammar shared with ids: {@code List`1[int]}, {@code List`1<>}, {@code int[,]}, {@code !0}, {@code !!1}. */
    @JsonIgnore
    default String canonical() {
        return CanonicalString.of(this);
    }

    /**
     * @param typeArguments CLR-flattened: arguments of containing types first, then the type's own; empty when unbound
     * @param unbound       the open generic type with no arguments at all: a Java raw type
     */
    record Named(NodeId type, List<TypeRef> typeArguments, boolean unbound, boolean nullable) implements TypeRef {}

    record TypeParameterRef(NodeId owner, int ordinal, boolean nullable) implements TypeRef {}

    record Array(TypeRef element, int rank, boolean nullable) implements TypeRef {}

    record Tuple(List<TupleElement> elements) implements TypeRef {}

    record TupleElement(String name, TypeRef type) {}

    record Function(Signature signature, String callingConvention) implements TypeRef {}

    record Structural(List<StructuralMember> members) implements TypeRef {}

    record StructuralMember(String name, TypeRef type) {}

    record Pointer(TypeRef pointee) implements TypeRef {}

    record Union(List<TypeRef> members) implements TypeRef {}

    record Intersection(List<TypeRef> members) implements TypeRef {}

    record Literal(String text) implements TypeRef {}

    record Primitive(String name, boolean nullable) implements TypeRef {}

    record Dynamic() implements TypeRef {}

    record Void() implements TypeRef {}

    record Unresolved(String text) implements TypeRef {}

    record Other(String text) implements TypeRef {}
}
