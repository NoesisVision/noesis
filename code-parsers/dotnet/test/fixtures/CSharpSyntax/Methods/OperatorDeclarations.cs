namespace CSharpSyntax.Methods;

public readonly struct OperatorDeclarations(int value) : IEquatable<OperatorDeclarations>
{
    public int Value { get; } = value;

    public static OperatorDeclarations operator +(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value + right.Value);
    public static OperatorDeclarations operator -(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value - right.Value);
    public static OperatorDeclarations operator *(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value * right.Value);
    public static OperatorDeclarations operator /(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value / right.Value);
    public static OperatorDeclarations operator %(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value % right.Value);
    public static OperatorDeclarations operator &(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value & right.Value);
    public static OperatorDeclarations operator |(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value | right.Value);
    public static OperatorDeclarations operator ^(OperatorDeclarations left, OperatorDeclarations right) => new(left.Value ^ right.Value);
    public static OperatorDeclarations operator <<(OperatorDeclarations left, int shift) => new(left.Value << shift);
    public static OperatorDeclarations operator >>(OperatorDeclarations left, int shift) => new(left.Value >> shift);
    public static OperatorDeclarations operator >>>(OperatorDeclarations left, int shift) => new(left.Value >>> shift);

    public static OperatorDeclarations operator +(OperatorDeclarations operand) => operand;
    public static OperatorDeclarations operator -(OperatorDeclarations operand) => new(-operand.Value);
    public static OperatorDeclarations operator !(OperatorDeclarations operand) => new(operand.Value == 0 ? 1 : 0);
    public static OperatorDeclarations operator ~(OperatorDeclarations operand) => new(~operand.Value);
    public static OperatorDeclarations operator ++(OperatorDeclarations operand) => new(operand.Value + 1);
    public static OperatorDeclarations operator --(OperatorDeclarations operand) => new(operand.Value - 1);
    public static bool operator true(OperatorDeclarations operand) => operand.Value != 0;
    public static bool operator false(OperatorDeclarations operand) => operand.Value == 0;

    public static bool operator ==(OperatorDeclarations left, OperatorDeclarations right) => left.Value == right.Value;
    public static bool operator !=(OperatorDeclarations left, OperatorDeclarations right) => left.Value != right.Value;
    public static bool operator <(OperatorDeclarations left, OperatorDeclarations right) => left.Value < right.Value;
    public static bool operator >(OperatorDeclarations left, OperatorDeclarations right) => left.Value > right.Value;
    public static bool operator <=(OperatorDeclarations left, OperatorDeclarations right) => left.Value <= right.Value;
    public static bool operator >=(OperatorDeclarations left, OperatorDeclarations right) => left.Value >= right.Value;

    public static OperatorDeclarations operator checked +(OperatorDeclarations left, OperatorDeclarations right) => new(checked(left.Value + right.Value));
    public static OperatorDeclarations operator checked -(OperatorDeclarations operand) => new(checked(-operand.Value));
    public static OperatorDeclarations operator checked ++(OperatorDeclarations operand) => new(checked(operand.Value + 1));

    public static implicit operator OperatorDeclarations(int value) => new(value);
    public static explicit operator int(OperatorDeclarations operand) => operand.Value;
    public static explicit operator checked byte(OperatorDeclarations operand) => checked((byte)operand.Value);
    public static explicit operator byte(OperatorDeclarations operand) => unchecked((byte)operand.Value);
    public static implicit operator string(OperatorDeclarations operand) => operand.Value.ToString();

    public static OperatorDeclarations operator +(OperatorDeclarations left, int right) => new(left.Value + right);
    public static OperatorDeclarations operator +(int left, OperatorDeclarations right) => new(left + right.Value);

    public bool Equals(OperatorDeclarations other) => Value == other.Value;
    public override bool Equals(object? obj) => obj is OperatorDeclarations other && Equals(other);
    public override int GetHashCode() => Value;
}

public class CompoundAssignmentOperatorDeclarations
{
    public int Value { get; private set; }

    // User-defined compound assignment operators (instance, void) and instance increment.
    public void operator +=(int value) => Value += value;
    public void operator -=(int value) => Value -= value;
    public void operator *=(int value) => Value *= value;
    public void operator ++() => Value++;
    public void operator --() => Value--;
    public void operator checked +=(int value) => Value = checked(Value + value);
}

public interface IOperatorsInInterface<TSelf> where TSelf : IOperatorsInInterface<TSelf>
{
    static abstract TSelf operator +(TSelf left, TSelf right);

    static abstract bool operator ==(TSelf left, TSelf right);

    static abstract bool operator !=(TSelf left, TSelf right);

    static virtual TSelf operator -(TSelf left, TSelf right) => left;

    static abstract explicit operator int(TSelf value);
}
