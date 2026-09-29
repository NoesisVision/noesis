using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.Time;

[DddDomainService]
public interface Clock
{
    DateTime Now { get; }
}