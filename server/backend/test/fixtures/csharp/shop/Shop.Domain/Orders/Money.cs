using NoesisVision.Annotations.Domain.DDD;

namespace Acme.Shop.Orders;

[DddValueObject]
public record Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0m, currency);

    public Money Add(Money other) => this with { Amount = Amount + other.Amount };

    public static Money operator +(Money a, Money b) => a.Add(b);
}

[DddValueObject]
public readonly record struct OrderId(Guid Value);

/// <summary>An enum is a block without members (R5.1).</summary>
[DddValueObject]
public enum OrderStatus
{
    Open,
    Placed,
}

/// <summary>The name override is no element name: the code's name stands (R4.2).</summary>
[DddValueObject("Acme.Shop.Badly named")]
public record BadlyNamed(int Value);

/// <summary>Not annotated: no block, so parameters of this type are left out.</summary>
public interface IClock
{
    DateTime Now();
}

/// <summary>A behaviour annotation on a type that is no block has no home (R9.11).</summary>
public static class Helpers
{
    [NoesisVision.Annotations.Domain.DomainBehavior("Lost")]
    public static int Count(IEnumerable<Money> amounts) => amounts.Count();
}
