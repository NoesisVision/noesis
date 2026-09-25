using JetBrains.Annotations;
using MyCompany.ECommerce.Contacts.Tags;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Contacts.Companies;

[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
[DddEntity]
public class CompanyTag
{
    public Guid CompanyId { get; set; }
    public Company Company { get; set; }

    public Guid TagId { get; set; }
    public Tag Tag { get; set; }
}