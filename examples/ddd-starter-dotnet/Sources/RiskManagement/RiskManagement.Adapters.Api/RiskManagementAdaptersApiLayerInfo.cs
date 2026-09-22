using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: AdaptersLayer]

namespace MyCompany.ECommerce.RiskManagement;

[UsedImplicitly]
public class RiskManagementAdaptersApiLayerInfo
{
    public static Assembly Assembly => typeof(RiskManagementAdaptersApiLayerInfo).Assembly;
}