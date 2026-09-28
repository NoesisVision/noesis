using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: UseCasesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.ProductsDelivery;

[UsedImplicitly]
public class ProductsDeliveryProcessModelLayerInfo
{
    public static Assembly Assembly => typeof(ProductsDeliveryProcessModelLayerInfo).Assembly;
}