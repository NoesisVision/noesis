package vision.noesis.scanner.model;

import java.util.List;

public record FieldNode(
        NodeId id,
        String name,
        Origin origin,
        List<SourceSpan> locations,
        List<Annotation> annotations,
        String documentation,
        LanguageBag languageSpecific,
        FieldKind fieldKind,
        Visibility visibility,
        List<Modifier> modifiers,
        TypeRef type,
        Passing passing,
        String constantValue) implements DeclarationNode {}
