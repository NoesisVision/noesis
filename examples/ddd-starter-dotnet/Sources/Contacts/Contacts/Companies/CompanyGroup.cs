using JetBrains.Annotations;
using MyCompany.ECommerce.Contacts.Groups;
using NoesisVision.Annotations.Domain.DDD;

namespace MyCompany.ECommerce.Contacts.Companies;

[UsedImplicitly(ImplicitUseTargetFlags.WithMembers)]
[DddEntity]
public class CompanyGroup
{
    public Company Company { get; set; }
    public Guid CompanyId { get; set; }

    public Group Group { get; set; }
    public Guid GroupId { get; set; }
}