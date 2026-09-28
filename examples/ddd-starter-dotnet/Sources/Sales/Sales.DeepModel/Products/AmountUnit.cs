using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Sales.Products;

[DddValueObject]
public enum AmountUnit
{
    Unit,
    Box,
    Palette
}