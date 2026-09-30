using MyCompany.ECommerce.Sales.Commons;
using NoesisVision.Annotations.Domain;

namespace MyCompany.ECommerce.Sales.ExchangeRates;

[ExternalSystemIntegration("Forex")]
public interface ExchangeRateProvider
{
    Task<ExchangeRate> GetFor(Currency currency);
}