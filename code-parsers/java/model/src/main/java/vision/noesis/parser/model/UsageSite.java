package vision.noesis.parser.model;

/** @param viaClosure the site is inside a lambda of the owning member. */
public record UsageSite(SourceSpan location, boolean viaClosure, LanguageBag languageSpecific) {}
