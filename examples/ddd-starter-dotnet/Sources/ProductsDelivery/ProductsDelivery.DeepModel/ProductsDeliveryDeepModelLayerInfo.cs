using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: EntitiesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.ProductsDelivery;

[UsedImplicitly]
public class ProductsDeliveryDeepModelLayerInfo
{
    public static Assembly Assembly => typeof(ProductsDeliveryDeepModelLayerInfo).Assembly;
}