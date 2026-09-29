using JetBrains.Annotations;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.Orders;

[DddValueObject]
[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
public class InvoicingDetails
{
    public string TaxId { get; set; }
    public string Name { get; set; }
    //...
}