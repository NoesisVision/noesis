namespace Noesis.Scanner.Model;

public sealed record PropertyNode : DeclarationNode
{
    public required Visibility Visibility { get; init; }
    public required IReadOnlyList<Modifier> Modifiers { get; init; }
    public required TypeRef Type { get; init; }
    public required Passing ReturnPassing { get; init; }
    public required IReadOnlyList<Parameter> Parameters { get; init; }
    public required TypeRef? ExtensionReceiver { get; init; }
    public required IReadOnlyList<Accessor> Accessors { get; init; }
}