package vision.noesis.scanner.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = NamespaceNode.class, name = "namespace"),
    @JsonSubTypes.Type(value = TypeNode.class, name = "type"),
    @JsonSubTypes.Type(value = MethodNode.class, name = "method"),
    @JsonSubTypes.Type(value = PropertyNode.class, name = "property"),
    @JsonSubTypes.Type(value = FieldNode.class, name = "field"),
})
public sealed interface DeclarationNode permits NamespaceNode, TypeNode, MethodNode, PropertyNode, FieldNode {

    NodeId id();

    String name();

    Origin origin();

    List<SourceSpan> locations();

    List<Annotation> annotations();

    String documentation();

    LanguageBag languageSpecific();
}
