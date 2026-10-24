package vision.noesis.parser.model;

import java.util.List;

/** @param ordinal CLR-flattened position: containing types' parameters count first. */
public record TypeParameter(
        String name,
        int ordinal,
        List<Annotation> annotations,
        Variance variance,
        List<TypeParameterConstraint> constraints,
        LanguageBag languageSpecific) {}
