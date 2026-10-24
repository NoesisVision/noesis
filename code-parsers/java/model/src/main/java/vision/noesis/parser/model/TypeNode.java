package vision.noesis.parser.model;

import java.util.List;

public record TypeNode(
        NodeId id,
        String name,
        Origin origin,
        List<SourceSpan> locations,
        List<Annotation> annotations,
        String documentation,
        LanguageBag languageSpecific,
        TypeKind typeKind,
        Visibility visibility,
        List<Modifier> modifiers,
        List<TypeParameter> typeParameters,
        TypeRef underlyingType,
        Signature delegateSignature,
        TypeRef aliasOf) implements DeclarationNode {}
