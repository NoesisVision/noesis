using Acme.Shop.Orders;

namespace Acme.Shop.Infrastructure;

/// <summary>No annotation, so no block (decision 3); its calls count for the interface's behaviours (R11.1).</summary>
public class SqlOrderRepository : Order.Repository
{
    public Task<Order> GetBy(OrderId id) => Task.FromResult(Order.Create(id));

    public Task Save(Order order)
    {
        Console.WriteLine(order.Total());
        return Task.CompletedTask;
    }
}
