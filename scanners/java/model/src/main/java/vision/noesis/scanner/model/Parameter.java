package vision.noesis.scanner.model;

import java.util.List;

public record Parameter(
        String name,
        TypeRef type,
        Passing passing,
        boolean variadic,
        boolean optional,
        String defaultValue,
        List<Annotation> annotations,
        LanguageBag languageSpecific) {}
