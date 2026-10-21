using Acme.Shop.Orders;
using Acme.Shop.Technical;
using NoesisVision.Annotations.Domain.DDD;

namespace Acme.Shop.Pricing;

[DddDomainService]
public class PricingService
{
    public Task<Money> PriceFor(Order order, CancellationToken cancellationToken = default) =>
        Task.FromResult(order.Total());

    public Result<Money> TryPrice(Order order) => Result<Money>.Ok(order.Total());

    public IEnumerable<Money> History(OrderId id) => [];

    public Money[] Last(int count) => [];

    public Func<Money, Money> Discount() => money => money;
}

/// <summary>A type parameter resolves through its constraint (R7.5).</summary>
[DddRepository]
public interface IRepository<T> where T : Order
{
    T Get(OrderId id);
}
