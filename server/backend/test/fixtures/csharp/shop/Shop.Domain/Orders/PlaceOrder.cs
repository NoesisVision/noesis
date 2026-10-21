using Acme.Shop.Pricing;
using Acme.Shop.Technical;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Domain.DDD;
using NoesisVision.Annotations.People;

namespace Acme.Shop.Orders;

[Command]
public record PlaceOrder(OrderId OrderId, string? Note);

[DddApplicationService]
public class PlaceOrderHandler(Order.Repository repository, PricingService pricing, IClock clock)
{
    [EntryPoint(TriggeredBy = TriggeredBy.Command)]
    [Actor("Customer")]
    public async Task Handle(PlaceOrder command, CancellationToken cancellationToken = default)
    {
        var order = Guard.NotNull(await repository.GetBy(command.OrderId));
        await pricing.PriceFor(order);
        order.Place(clock);
        LogTotal(order);
        await repository.Save(order);
    }

    private void LogTotal(Order order) => Console.WriteLine(order.Total());
}
