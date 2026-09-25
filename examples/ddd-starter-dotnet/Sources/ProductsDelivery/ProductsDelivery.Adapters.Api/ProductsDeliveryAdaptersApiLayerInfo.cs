using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: AdaptersLayer]

namespace MyCompany.ECommerce.ProductsDelivery;

[UsedImplicitly]
public class ProductsDeliveryAdaptersApiLayerInfo
{
    public static Assembly Assembly => typeof(ProductsDeliveryAdaptersApiLayerInfo).Assembly;
}