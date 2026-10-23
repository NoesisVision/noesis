package vision.noesis.scanner.model;

import java.util.List;

/** @param bodiless true when the body is absent by design: abstract, interface member without a body, native. */
public record MethodNode(
        NodeId id,
        String name,
        Origin origin,
        List<SourceSpan> locations,
        List<Annotation> annotations,
        String documentation,
        LanguageBag languageSpecific,
        MethodKind methodKind,
        Visibility visibility,
        List<Modifier> modifiers,
        List<TypeParameter> typeParameters,
        Signature signature,
        TypeRef extensionReceiver,
        boolean bodiless) implements DeclarationNode {}
