package vision.noesis.parser.model;

import java.util.List;

public record NamespaceNode(
        NodeId id,
        String name,
        Origin origin,
        List<SourceSpan> locations,
        List<Annotation> annotations,
        String documentation,
        LanguageBag languageSpecific) implements DeclarationNode {}
