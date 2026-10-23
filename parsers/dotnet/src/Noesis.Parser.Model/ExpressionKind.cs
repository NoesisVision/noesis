namespace Noesis.Parser.Model;

public enum ExpressionKind
{
    This,
    Base,
    TypeParameter,
    Parameter,
    Local,
    Field,
    Property,
    ReturnValue,
    Type,
    Creation,
    Literal,
    Other,
}