using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: AdaptersLayer]

namespace MyCompany.ECommerce.Payments;

[UsedImplicitly]
public static class PaymentsAdaptersApiLayerInfo
{
    public static Assembly Assembly => typeof(PaymentsAdaptersApiLayerInfo).Assembly;
}