namespace Noesis.Parser.Model;

public sealed record UsageSite(SourceSpan Location, bool ViaClosure, LanguageBag LanguageSpecific);