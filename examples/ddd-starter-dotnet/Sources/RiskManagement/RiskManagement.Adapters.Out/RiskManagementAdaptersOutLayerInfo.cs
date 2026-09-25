using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: AdaptersLayer]

namespace MyCompany.ECommerce.RiskManagement;

[UsedImplicitly]
public class RiskManagementAdaptersOutLayerInfo
{
    public static Assembly Assembly => typeof(RiskManagementAdaptersOutLayerInfo).Assembly;
}