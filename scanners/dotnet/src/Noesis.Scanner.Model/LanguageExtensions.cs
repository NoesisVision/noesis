namespace Noesis.Scanner.Model;

public static class LanguageExtensions
{
    public static string Identifier(this Language language) => language switch
    {
        Language.CSharp => "csharp",
        Language.Java => "java",
        Language.TypeScript => "typescript",
        Language.Php => "php",
        _ => throw new ArgumentOutOfRangeException(nameof(language), language, null),
    };
}