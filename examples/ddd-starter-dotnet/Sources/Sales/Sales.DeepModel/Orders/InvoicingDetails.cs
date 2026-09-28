using JetBrains.Annotations;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.Orders;

[DddValueObject]
[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
public class InvoicingDetails
{
    [BindRequired] public string TaxId { get; set; }
    [BindRequired] public string Name { get; set; }
    //...
}