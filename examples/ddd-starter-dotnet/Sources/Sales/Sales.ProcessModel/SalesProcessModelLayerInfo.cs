using System.Reflection;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: UseCasesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.Sales;

public static class SalesProcessModelLayerInfo
{
    public static Assembly Assembly => typeof(SalesProcessModelLayerInfo).Assembly;
}