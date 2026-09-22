using JetBrains.Annotations;
using MyCompany.ECommerce.TechnicalStuff.ProcessModel;
using NoesisVision.Annotations.Domain;

namespace MyCompany.ECommerce.RiskManagement.Publication;

[UsedImplicitly]
public class GetRiskScoreHandler : QueryHandler<GetRiskScore, decimal>
{
    [EntryPoint(nameof(GetRiskScore), Process = RiskScorePublicationProcess.Name)]
    public Task<decimal> Handle(GetRiskScore query)
    {
        throw new NotImplementedException();
    }
}