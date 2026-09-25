using MyCompany.ECommerce.TechnicalStuff.Persistence;
using MyCompany.ECommerce.TechnicalStuff.Postgres;
using NoesisVision.Annotations.Technology;

namespace MyCompany.ECommerce.Infrastructure;

[Database("Main", ServerName = "Postgres")]
public class MainECommerceDb : PostgresTransactionProvider, MainDb
{
    public MainECommerceDb(string connectionString) : base(connectionString) { }
}