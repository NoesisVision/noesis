using System.Collections;
using TypesNamespace = CSharpSyntax.Types;

namespace CSharpSyntax.Usings.Dotted.Deeply.Nested;

public class ClassInDeeplyNestedNamespace
{
    // Namespace alias disambiguates from the type `CSharpSyntax.Usings.Dotted.Deeply.Nested.Types`.
    public TypesNamespace.PublicClass ViaNamespaceAliasAvoidingConflict = new();

    public Types ViaConflictingTypeName = new();

    public IEnumerable NonGenericInterfaceViaNamespaceImport = Array.Empty<int>();

    public IEnumerable<int> GenericInterfaceViaImplicitUsing = [];
}

public class Types;
