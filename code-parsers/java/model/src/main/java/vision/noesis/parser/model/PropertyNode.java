package vision.noesis.parser.model;

import java.util.List;

public record PropertyNode(
        NodeId id,
        String name,
        Origin origin,
        List<SourceSpan> locations,
        List<Annotation> annotations,
        String documentation,
        LanguageBag languageSpecific,
        Visibility visibility,
        List<Modifier> modifiers,
        TypeRef type,
        Passing returnPassing,
        List<Parameter> parameters,
        TypeRef extensionReceiver,
        List<Accessor> accessors) implements DeclarationNode {}
