using MyCompany.ECommerce.Sales.Orders;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.WholesaleOrdering;

[DddRepository]
public interface OrderDetailsFinder
{
    Task<AllOrderDetails> GetBy(Guid id);
}