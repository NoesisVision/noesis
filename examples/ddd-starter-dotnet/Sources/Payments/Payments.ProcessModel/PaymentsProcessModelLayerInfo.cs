using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: UseCasesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.Payments;

[UsedImplicitly]
public class PaymentsProcessModelLayerInfo
{
    public static Assembly Assembly => typeof(PaymentsProcessModelLayerInfo).Assembly;
}