using CSharpSyntax.Types;

// File-scoped namespace: the whole file belongs to it.
namespace CSharpSyntax.Usings.FileScoped;

public class ClassInFileScopedNamespace
{
    public PublicClass ViaImport = new();

    public UsingDirectiveForms ViaParentNamespaceResolution = new();

    public global::CSharpSyntax.Usings.UsingDirectiveForms ViaGlobalQualifiedName = new();
}
