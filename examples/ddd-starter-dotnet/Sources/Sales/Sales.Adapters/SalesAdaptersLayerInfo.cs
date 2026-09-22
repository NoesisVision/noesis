using System.Reflection;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: AdaptersLayer]

namespace MyCompany.ECommerce.Sales;

public static class SalesAdaptersLayerInfo
{
    public static Assembly Assembly => typeof(SalesAdaptersLayerInfo).Assembly;
}