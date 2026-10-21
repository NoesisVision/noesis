using Acme.Shop.Products;
using Acme.Shop.Technical;
using NoesisVision.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Domain.DDD;
using NoesisVision.Annotations.People;

namespace Acme.Shop.Orders;

/// <summary>Doc comment, shadowed by the ShortDescription (R4.5).</summary>
[DddAggregate]
[ShortDescription("An order *placed* by a customer.")]
[Scenario("Order is placed")]
public partial class Order : Entity<OrderId>
{
    private readonly List<Line> _lines = new();
    public const int MaxLines = 10;
    public static int Created;
    public event Action? Placed;

    public Order(OrderId id) => Id = id;

    /// <summary>The order's lines.</summary>
    public IReadOnlyList<Line> Lines => _lines;
    public Money? Discount { get; private set; }
    public DateTime? PlacedOn { get; private set; }
    public OrderStatus Status { get; private set; } = OrderStatus.Open;
    public Dictionary<string, int> Tags { get; } = new();
    public IClock? Clock { get; set; }
    public int this[int index] => index;
    [ExcludeFromDocs]
    public string Secret { get; set; } = "";

    [Actor("Customer")]
    public void AddLine(ProductId product, int quantity)
    {
        _lines.Add(new Line(product, quantity));
        Recalculate();
    }

    public void AddLine(ProductId product) => AddLine(product, 1);

    [EntryPoint(TriggeredBy = TriggeredBy.Query)]
    public Money Total() => _lines.Aggregate(Money.Zero("EUR"), (sum, line) => sum.Add(line.Price()));

    /// <summary>Places the order.</summary>
    [DomainBehavior("Place order")]
    [Scenario("Placed with lines")]
    public void Place(IClock clock)
    {
        Guard.NotNull(clock);
        PlacedOn = clock.Now();
        Status = OrderStatus.Placed;
        Audit();
        Placed?.Invoke();
    }

    [Scenario("Created.With.Dots")]
    public static Order Create(OrderId id) => new(id);

    public Task Persist(Repository repository) => repository.Save(this);

    [ExcludeFromDocs]
    public void Debug() { }

    public override string ToString() => $"Order {Id}";

    internal void Recalculate() => Discount = Total();

    private void Audit() => Recalculate();

    [DddRepository]
    public interface Repository
    {
        Task<Order> GetBy(OrderId id);
        Task Save(Order order);
    }

    [Event]
    public record LineAdded(ProductId Product, int Quantity);

    [DddEntity("Order line")]
    public class Line
    {
        public Line(ProductId product, int quantity)
        {
            Product = product;
            Quantity = quantity;
        }

        public ProductId Product { get; }
        public int Quantity { get; }

        public Money Price() => new(Quantity * 10m, "EUR");
    }
}
