using System.Reflection;
using JetBrains.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: UseCasesLayer]
[assembly: DomainModel]

namespace MyCompany.ECommerce.RiskManagement;

[UsedImplicitly]
public class RiskManagementProcessModelLayerInfo
{
    public static Assembly Assembly => typeof(RiskManagementProcessModelLayerInfo).Assembly;
}