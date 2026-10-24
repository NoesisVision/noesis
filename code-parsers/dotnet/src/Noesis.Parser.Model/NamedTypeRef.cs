namespace Noesis.Parser.Model;

/// <param name="TypeArguments">CLR-flattened: arguments of containing types first, then the type's own; empty when unbound.</param>
/// <param name="Unbound">The open generic type with no arguments at all, as in `typeof(List&lt;&gt;)`.</param>
public sealed record NamedTypeRef(NodeId Type, IReadOnlyList<TypeRef> TypeArguments, bool Unbound, bool Nullable) : TypeRef;