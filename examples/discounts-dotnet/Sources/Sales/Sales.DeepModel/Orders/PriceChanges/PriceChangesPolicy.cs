using System.Collections.Immutable;
using MyCompany.ECommerce.Sales.Pricing;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.Orders.PriceChanges;

[DddDomainService]
public interface PriceChangesPolicy
{
    bool CanChangePrices(ImmutableArray<Quote> oldQuotes, ImmutableArray<Quote> newQuotes);
}