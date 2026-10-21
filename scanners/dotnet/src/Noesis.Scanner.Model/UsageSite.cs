namespace Noesis.Scanner.Model;

public sealed record UsageSite(SourceSpan Location, bool ViaClosure, LanguageBag Language);