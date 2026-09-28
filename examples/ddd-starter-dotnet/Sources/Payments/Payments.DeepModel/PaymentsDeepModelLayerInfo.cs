using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: EntitiesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.Payments;

[UsedImplicitly]
public class PaymentsDeepModelLayerInfo
{
    public static Assembly Assembly => typeof(PaymentsDeepModelLayerInfo).Assembly;
}