using JetBrains.Annotations;
using MyCompany.ECommerce.TechnicalStuff.ProcessModel;
using NoesisVision.Annotations.Domain;

namespace MyCompany.ECommerce.Payments.Requesting;

[UsedImplicitly]
public class RequestPaymentHandler : CommandHandler<RequestPayment>
{
    [EntryPoint(nameof(RequestPayment), Process = PaymentProcess.Name)]
    public Task Handle(RequestPayment command)
    {
        throw new System.NotImplementedException();
    }
}