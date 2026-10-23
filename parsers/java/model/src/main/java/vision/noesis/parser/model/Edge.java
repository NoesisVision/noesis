package vision.noesis.parser.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = Edge.Contains.class, name = "CONTAINS"),
    @JsonSubTypes.Type(value = Edge.Extends.class, name = "EXTENDS"),
    @JsonSubTypes.Type(value = Edge.Implements.class, name = "IMPLEMENTS"),
    @JsonSubTypes.Type(value = Edge.Overrides.class, name = "OVERRIDES"),
    @JsonSubTypes.Type(value = Edge.ImplementsMember.class, name = "IMPLEMENTS_MEMBER"),
    @JsonSubTypes.Type(value = Edge.Invokes.class, name = "INVOKES"),
    @JsonSubTypes.Type(value = Edge.Accesses.class, name = "ACCESSES"),
    @JsonSubTypes.Type(value = Edge.UsesType.class, name = "USES_TYPE"),
})
public sealed interface Edge {

    NodeId from();

    record Contains(NodeId from, NodeId to) implements Edge {}

    record Extends(NodeId from, TypeRef to) implements Edge {}

    record Implements(NodeId from, TypeRef to) implements Edge {}

    record Overrides(NodeId from, NodeId to) implements Edge {}

    /**
     * @param to            the interface member definition
     * @param interfaceType the constructed interface
     * @param declaredOn    the type whose interface list produced this mapping
     */
    record ImplementsMember(NodeId from, NodeId to, @JsonProperty("interface") TypeRef interfaceType, NodeId declaredOn) implements Edge {}

    /** @param to the method definition; a constructor for {@code new T()}. */
    record Invokes(NodeId from, NodeId to, List<TypeRef> typeArguments, UsageSite site, InvocationKind invocationKind, ExpressionKind receiver) implements Edge {}

    record Accesses(NodeId from, NodeId to, AccessKind access, UsageSite site, ExpressionKind receiver) implements Edge {}

    record UsesType(NodeId from, TypeRef to, TypeUseRole role, UsageSite site) implements Edge {}
}
