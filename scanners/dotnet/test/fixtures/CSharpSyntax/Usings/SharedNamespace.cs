// The same namespace is declared in both projects of the solution; see CSharpSyntax.OtherProject/SharedNamespaceInOtherProject.cs.
namespace CSharpSyntax.SharedNamespace;

public class ClassInSharedNamespaceFromMainProject
{
    public ClassInSharedNamespaceFromOtherProject FromOtherProjectPartOfSameNamespace = new();
}
